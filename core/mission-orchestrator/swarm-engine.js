const fs = require("fs");
const path = require("path");
const RealityExecutor = require("../executor/reality-executor");

const GRAPH_PATH = path.join(__dirname, "..", "..", "data", "assets", "marauder-graph.json");

const ALLOWED_TARGETS = new Set([
  "localhost",
  "127.0.0.1",
  "verified-local-lab",
  "admiralerror-local-lab"
]);

class MarauderSwarmEngine {
  constructor(ollamaUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434", model = process.env.OLLAMA_MODEL || "llama3.2") {
    this.ollamaUrl = ollamaUrl;
    this.model = model;
    this.executor = new RealityExecutor();
    fs.mkdirSync(path.dirname(GRAPH_PATH), { recursive: true });
  }

  enforceScope(target) {
    const clean = String(target || "").trim();
    if (!ALLOWED_TARGETS.has(clean)) {
      return {
        allowed: false,
        reason: `Target "${clean}" is outside technical scope allowlist. Allowed: ${Array.from(ALLOWED_TARGETS).join(", ")}`
      };
    }
    return { allowed: true, target: clean };
  }

  async askRole(role, systemPrompt, userPrompt) {
    const res = await fetch(`${this.ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        system: systemPrompt,
        prompt: userPrompt,
        stream: false
      })
    });
    if (!res.ok) {
      throw new Error(`Ollama ${role} failed (${res.status}): ${await res.text()}`);
    }
    const data = await res.json();
    return (data.response || "").trim();
  }

  updateGraph(nodeType, payload) {
    let graph = { updatedAt: new Date().toISOString(), nodes: {} };
    if (fs.existsSync(GRAPH_PATH)) {
      graph = JSON.parse(fs.readFileSync(GRAPH_PATH, "utf8"));
    }
    if (!graph.nodes[nodeType]) graph.nodes[nodeType] = [];
    graph.nodes[nodeType].push({ at: new Date().toISOString(), ...payload });
    graph.updatedAt = new Date().toISOString();
    fs.writeFileSync(GRAPH_PATH, JSON.stringify(graph, null, 2));
    return graph;
  }

  async runMission({ mission, target = "verified-local-lab" }) {
    const scope = this.enforceScope(target);
    if (!scope.allowed) {
      const blockedEv = this.executor.evidence.recordExecution({
        command: `mission:${mission}`,
        target,
        agent: "Scope Controller",
        permission: "NONE",
        realOutput: "",
        evidence: scope.reason,
        result: "DENIED_OUT_OF_SCOPE"
      });
      return { ok: false, status: "OUT_OF_SCOPE", error: scope.reason, evidence: blockedEv };
    }

    // 1. PLANNER selects specialist roles
    const planText = await this.askRole(
      "Mission Planner",
      "You are MARAUDER Mission Planner. Pick 3 concise specialist roles for the mission and output short action bullets. Never claim unverified results.",
      `Target: ${scope.target}\nMission: ${mission}`
    );

    // 2. REAL EXECUTION + EVIDENCE
    const realCheck = process.platform === "win32"
      ? await this.executor.runSafeCheck({
          agent: "Discovery + Endpoint Specialist",
          capability: "process.inspect",
          target: scope.target,
          bin: "cmd",
          args: ["/c", "hostname"]
        })
      : await this.executor.runSafeCheck({
          agent: "Discovery + Endpoint Specialist",
          capability: "filesystem.read",
          target: scope.target,
          bin: "uname",
          args: ["-sr"]
        });

    // 3. DEBATE / CROSS-CHECK between Critic/Defender and Second-Agent Verifier
    const debateText = await this.askRole(
      "Debate & Cross-Check Agent",
      "You are MARAUDER Cross-Check & Skeptic Agent. Challenge assumptions, highlight false-positive risks, and state only what is backed by the observed output.",
      `Mission: ${mission}\nEvidence ID: ${realCheck.id}\nObserved Output: ${realCheck.realOutput}\nResult: ${realCheck.result}`
    );

    const secondVerify = await this.askRole(
      "Second-Agent Verifier",
      "You are MARAUDER Second-Agent Verifier. Confirm whether the finding/observation is backed by real evidence and give a concise CONFIRMED or NEEDS_MORE_EVIDENCE verdict.",
      `Evidence: ${JSON.stringify({ id: realCheck.id, result: realCheck.result, output: realCheck.realOutput })}\nDebate: ${debateText}`
    );

    const confirmed = realCheck.result === "VERIFIED" && !/NEEDS_MORE_EVIDENCE/i.test(secondVerify);
    const graph = this.updateGraph("missions", {
      target: scope.target,
      mission,
      evidenceId: realCheck.id,
      status: confirmed ? "CONFIRMED" : "UNCONFIRMED"
    });

    return {
      ok: true,
      pipeline: ["PLANNER", "SWARM_SPECIALISTS", "DEBATE_CROSS_CHECK", "REAL_EXECUTION", "EVIDENCE", "SECOND_AGENT_VERIFY"],
      target: scope.target,
      mission,
      plan: planText,
      executionEvidence: realCheck,
      debate: debateText,
      secondAgentVerification: secondVerify,
      status: confirmed ? "CONFIRMED" : "UNCONFIRMED",
      graphUpdatedAt: graph.updatedAt
    };
  }
}

module.exports = MarauderSwarmEngine;
