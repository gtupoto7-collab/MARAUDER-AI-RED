const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { MarauderRootController, sha256 } = require("./marauder-root-controller");

class ThreatGraph {
  constructor() {
    this.nodes = new Map(); // id -> { id, type, label, props, sources: Set }
    this.edges = new Set(); // "from->to:rel"
  }

  upsertNode(type, label, props = {}, sourceAgentId = "SYSTEM") {
    const cleanType = String(type || "ARTIFACT").toUpperCase();
    const cleanLabel = String(label || "").trim();
    if (!cleanLabel) return null;
    const id = `${cleanType}:${cleanLabel}`;
    if (!this.nodes.has(id)) {
      this.nodes.set(id, {
        id,
        type: cleanType,
        label: cleanLabel,
        props: { ...props },
        sources: new Set([sourceAgentId])
      });
    } else {
      const existing = this.nodes.get(id);
      existing.props = { ...existing.props, ...props };
      existing.sources.add(sourceAgentId);
    }
    return id;
  }

  link(fromId, toId, relation = "RELATED_TO") {
    if (!fromId || !toId || !this.nodes.has(fromId) || !this.nodes.has(toId)) return false;
    this.edges.add(`${fromId}-->${toId}[${relation}]`);
    return true;
  }

  summary() {
    const byType = {};
    for (const n of this.nodes.values()) {
      byType[n.type] = (byType[n.type] || 0) + 1;
    }
    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.size,
      byType,
      edges: Array.from(this.edges)
    };
  }
}

class SynchroMeshOrchestrator {
  constructor(options = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.agentsFile =
      options.agentsFile || path.join(this.rootDir, "data", "agent-army", "agents.json");
    this.concurrency = Math.max(1, Number(options.concurrency || 4));
    this.controller =
      options.controller || new MarauderRootController({ rootDir: this.rootDir });
    this.graph = new ThreatGraph();
    this.agentsById = new Map();
    this._loadCatalog();
  }

  _loadCatalog() {
    if (!fs.existsSync(this.agentsFile)) {
      throw new Error(`CATALOG_NOT_FOUND:${this.agentsFile}`);
    }
    const raw = JSON.parse(fs.readFileSync(this.agentsFile, "utf8"));
    const list = Array.isArray(raw) ? raw : raw.agents;
    if (!Array.isArray(list)) {
      throw new Error("INVALID_AGENT_CATALOG_FORMAT");
    }
    for (const ag of list) {
      if (ag && ag.id) {
        this.agentsById.set(String(ag.id), ag);
      }
    }
  }

  getAgentProfile(agentId) {
    return this.agentsById.get(String(agentId)) || null;
  }

  /**
   * Изпълнява DAG от задачи през динамичен worker pool.
   * Всяка задача: { id, agentId, capability, scope, payload, dependsOn: [], retries: 1, runner: fn }
   */
  async runMission(missionId, tasks = []) {
    const taskMap = new Map();
    for (const t of tasks) {
      if (!t || !t.id || !t.agentId) {
        throw new Error("TASK_REQUIRES_ID_AND_AGENT_ID");
      }
      taskMap.set(t.id, {
        ...t,
        dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn : [],
        retries: typeof t.retries === "number" ? t.retries : 1,
        state: "PENDING",
        output: null,
        error: null
      });
    }

    const completed = new Map(); // taskId -> output
    const failed = new Map(); // taskId -> reason
    const running = new Set();

    const canRun = (task) => {
      if (task.state !== "PENDING") return false;
      for (const depId of task.dependsOn) {
        if (failed.has(depId)) {
          task.state = "SKIPPED_DEP_FAILED";
          failed.set(task.id, `DEP_FAILED:${depId}`);
          return false;
        }
        if (!completed.has(depId)) return false;
      }
      return true;
    };

    const executeOne = async (task) => {
      running.add(task.id);
      task.state = "RUNNING";

      const profile = this.getAgentProfile(task.agentId);
      if (!profile) {
        task.state = "FAILED";
        failed.set(task.id, `AGENT_NOT_IN_CATALOG:${task.agentId}`);
        running.delete(task.id);
        return;
      }

      const depContext = {};
      for (const depId of task.dependsOn) {
        if (completed.has(depId)) depContext[depId] = completed.get(depId);
      }

      let attempt = 0;
      let lastReason = null;

      while (attempt <= task.retries) {
        attempt += 1;
        const now = Date.now();
        const envelope = {
          missionId,
          taskId: task.id,
          attempt,
          agent: {
            id: profile.id,
            role: profile.role,
            model: profile.model || "ollama:llama3.2",
            profileHash: profile.profileHash || null
          },
          capability: task.capability,
          scope: task.scope,
          nonce: `${missionId}-${task.id}-${attempt}-${crypto.randomBytes(4).toString("hex")}`,
          issuedAt: now,
          expiresAt: now + 30000,
          approvalId: task.approvalId || null,
          payload: {
            ...(task.payload || {}),
            upstreamEvidence: depContext
          }
        };

        const sig = this.controller.signRequest(envelope);
        const authRes = this.controller.authorizeAndPrepare(envelope, sig, (ctx) => {
          if (typeof task.runner === "function") {
            return task.runner({
              ...ctx,
              profile,
              graph: this.graph,
              upstreamEvidence: depContext
            });
          }
          return {
            agentId: profile.id,
            role: profile.role,
            capability: task.capability,
            observedAt: new Date().toISOString()
          };
        });

        if (authRes.allowed) {
          task.state = "COMPLETED";
          task.output = authRes.result;
          completed.set(task.id, authRes.result);
          running.delete(task.id);
          return;
        }

        lastReason = authRes.reason;
      }

      task.state = "FAILED";
      failed.set(task.id, lastReason || "EXECUTION_DENIED");
      running.delete(task.id);
    };

    while (completed.size + failed.size < taskMap.size) {
      const ready = [];
      for (const task of taskMap.values()) {
        if (canRun(task)) ready.push(task);
      }

      if (ready.length === 0 && running.size === 0) {
        // Deadlock / cycle guard
        for (const task of taskMap.values()) {
          if (task.state === "PENDING") {
            task.state = "DEADLOCKED";
            failed.set(task.id, "UNRESOLVED_DEPENDENCIES");
          }
        }
        break;
      }

      while (running.size < this.concurrency && ready.length > 0) {
        const nextTask = ready.shift();
        executeOne(nextTask);
      }

      if (running.size > 0) {
        await new Promise((r) => setTimeout(r, 15));
      }
    }

    const missionDigest = sha256(
      JSON.stringify({
        missionId,
        completedCount: completed.size,
        failedCount: failed.size,
        graphSummary: this.graph.summary()
      })
    );

    return {
      missionId,
      catalogSize: this.agentsById.size,
      completedCount: completed.size,
      failedCount: failed.size,
      completed: Object.fromEntries(completed.entries()),
      failed: Object.fromEntries(failed.entries()),
      graph: this.graph.summary(),
      ledger: this.controller.verifyLedger(),
      missionDigest
    };
  }
}


  async runOllamaAnalysis({
    missionId = "MISSION-SWARM-OLLAMA-01",
    agentId,
    prompt,
    model = "llama3.2",
    scope = "local:ollama",
    timeoutMs = 20000,
    ollamaUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434/api/generate"
  }) {
    const chosenId =
      agentId ||
      Array.from(this.agentsById.keys())[0] ||
      "AI-AGT-001";
    const profile = this.getAgentProfile(chosenId);
    if (!profile) {
      return { ok: false, error: `AGENT_NOT_IN_CATALOG:${chosenId}` };
    }

    const now = Date.now();
    const envelope = {
      missionId,
      taskId: `OLLAMA-${Date.now()}`,
      attempt: 1,
      mode: "COMMAND",
      agent: {
        id: profile.id,
        role: profile.role,
        model: `ollama:${model}`,
        profileHash: profile.profileHash || null
      },
      capability: "llm:local-analyze",
      scope,
      nonce: `ollama-${now}-${crypto.randomBytes(4).toString("hex")}`,
      issuedAt: now,
      expiresAt: now + 30000,
      payload: { prompt, model }
    };

    const sig = this.controller.signRequest(envelope);
    let llmOutput = null;

    const authRes = this.controller.authorizeAndPrepare(envelope, sig, () => {
      return { queued: true, model, agentId: profile.id };
    });

    if (!authRes.allowed) {
      return { ok: false, reason: authRes.reason, audit: authRes.audit };
    }

    const controllerAbort = new AbortController();
    const timer = setTimeout(() => controllerAbort.abort(), timeoutMs);

    try {
      const resp = await fetch(ollamaUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt: String(prompt || "").slice(0, 4000),
          stream: false
        }),
        signal: controllerAbort.signal
      });

      if (!resp.ok) {
        return {
          ok: false,
          reason: `OLLAMA_HTTP_${resp.status}`,
          agentId: profile.id,
          ledger: this.controller.verifyLedger()
        };
      }

      const data = await resp.json();
      llmOutput = String(data.response || "").trim();
      const digest = sha256(llmOutput);
      const nodeId = this.graph.upsertNode(
        "IOC",
        `OLLAMA-ANALYSIS:${digest.slice(0, 12)}`,
        { model, sha256: digest, preview: llmOutput.slice(0, 240) },
        profile.id
      );

      return {
        ok: true,
        missionId,
        agentId: profile.id,
        role: profile.role,
        model,
        response: llmOutput,
        responseHash: digest,
        graphNodeId: nodeId,
        ledger: this.controller.verifyLedger()
      };
    } catch (err) {
      return {
        ok: false,
        reason: err.name === "AbortError" ? "OLLAMA_TIMEOUT" : `OLLAMA_UNREACHABLE:${err.message}`,
        agentId: profile.id,
        ledger: this.controller.verifyLedger()
      };
    } finally {
      clearTimeout(timer);
    }
  }

module.exports = { SynchroMeshOrchestrator, ThreatGraph };
