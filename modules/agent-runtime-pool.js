const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");

class AgentRuntimePool {
  constructor(projectDir = process.cwd(), options = {}) {
    this.projectDir = projectDir;
    this.concurrency = options.concurrency || 4;
    this.model = options.model || "llama3.2:latest";

    this.runtimes = new Map();
    this.active = 0;
    this.queue = [];
  }

  register(agent) {
    if (!agent || !agent.id) {
      throw new Error("INVALID_AGENT");
    }

    if (!this.runtimes.has(agent.id)) {
      this.runtimes.set(agent.id, {
        agentId: agent.id,
        name: agent.name,
        role: agent.role,
        model: agent.model || `ollama:${this.model}`,
        capabilities: [...(agent.capabilities || [])],
        runs: 0,
        failures: 0,
        createdAt: new Date().toISOString()
      });
    }

    return this.runtimes.get(agent.id);
  }

  registerMany(agents) {
    for (const agent of agents) {
      this.register(agent);
    }

    return this.runtimes.size;
  }

  get(agentId) {
    return this.runtimes.get(agentId) || null;
  }

  list() {
    return [...this.runtimes.values()];
  }

  async _runOllama(prompt) {
    return new Promise((resolve, reject) => {
      execFile(
        "ollama",
        ["run", this.model, prompt],
        {
          cwd: this.projectDir,
          encoding: "utf8",
          timeout: 120000,
          maxBuffer: 1024 * 1024
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(
              `${error.message}${stderr ? `: ${stderr.trim()}` : ""}`
            ));
            return;
          }

          resolve(stdout.trim());
        }
      );
    });
  }

  async execute(agentId, task) {
    const runtime = this.get(agentId);

    if (!runtime) {
      throw new Error(`RUNTIME_NOT_FOUND:${agentId}`);
    }

    if (!task || !String(task).trim()) {
      throw new Error("TASK_REQUIRED");
    }

    const startedAt = new Date().toISOString();
    const t0 = Date.now();

    const systemIdentity = [
      `You are agent ${runtime.agentId}.`,
      `Agent name: ${runtime.name}.`,
      `Role: ${runtime.role}.`,
      `Capabilities: ${runtime.capabilities.join(", ")}.`,
      "You are one isolated agent runtime in a multi-agent system.",
      "Do not claim to be a different agent.",
      "Perform only the task provided below."
    ].join("\n");

    const prompt = `${systemIdentity}\n\nTASK:\n${String(task)}`;

    try {
      const output = await this._runOllama(prompt);

      runtime.runs += 1;

      const record = {
        runId: `INF-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
        agentId: runtime.agentId,
        agentName: runtime.name,
        role: runtime.role,
        model: runtime.model,
        startedAt,
        finishedAt: new Date().toISOString(),
        latencyMs: Date.now() - t0,
        inferenceExit: 0,
        outputHash: crypto
          .createHash("sha256")
          .update(output)
          .digest("hex"),
        output,
        verified: Boolean(output)
      };

      return record;
    } catch (error) {
      runtime.failures += 1;

      return {
        agentId: runtime.agentId,
        agentName: runtime.name,
        role: runtime.role,
        model: runtime.model,
        latencyMs: Date.now() - t0,
        inferenceExit: 1,
        error: error.message,
        verified: false
      };
    }
  }
}

module.exports = AgentRuntimePool;
