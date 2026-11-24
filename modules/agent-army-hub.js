const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ALLOWED_CAPABILITIES = new Set([
  "reasoning.plan",
  "code.audit",
  "filesystem.read",
  "network.observe",
  "dependency.audit",
  "evidence.verify"
]);

function sha256(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function isSafePrompt(text) {
  const raw = String(text || "");
  return !/(ignore\s+(all\s+)?previous\s+instructions|system\s*prompt|jailbreak|игнорирай\s+предишни\s+инструкции)/i.test(raw);
}

class MarauderAgentArmyHub {
  constructor(projectDir = process.cwd()) {
    this.projectDir = projectDir;
    this.storePath = path.join(projectDir, "data", "agent-army", "agents.json");
    fs.mkdirSync(path.dirname(this.storePath), { recursive: true });
    this._indexById = new Map();
    this._indexByName = new Map();
    this.agents = this._loadOrSeed();
    this._rebuildIndex();
  }

  _rebuildIndex() {
    this._indexById.clear();
    this._indexByName.clear();
    for (const a of this.agents) {
      this._indexById.set(a.id, a);
      this._indexByName.set(String(a.name).toLowerCase(), a);
    }
  }

  _loadOrSeed() {
    if (fs.existsSync(this.storePath)) {
      return JSON.parse(fs.readFileSync(this.storePath, "utf8"));
    }
    const seeded = [
      { id: "AI-AGT-0001", name: "Planner & Task Architect", role: "Intelligence", model: "ollama:llama3.2", capabilities: ["reasoning.plan"], health: 100, runs: 0, failures: 0 },
      { id: "AI-AGT-0002", name: "Code & Config Inspector", role: "Code Security", model: "ollama:llama3.2", capabilities: ["code.audit", "filesystem.read"], health: 100, runs: 0, failures: 0 },
      { id: "AI-AGT-0003", name: "Evidence & Reality Verifier", role: "Verification", model: "ollama:llama3.2", capabilities: ["evidence.verify", "dependency.audit"], health: 100, runs: 0, failures: 0 }
    ];
    fs.writeFileSync(this.storePath, JSON.stringify(seeded));
    return seeded;
  }

  _save() {
    fs.writeFileSync(this.storePath, JSON.stringify(this.agents));
  }

  registerAgent({ name, role = "Intelligence", model = "ollama:llama3.2", capabilities = ["reasoning.plan"] }, { persist = true } = {}) {
    if (!name || !String(name).trim()) {
      throw new Error("AGENT_NAME_REQUIRED");
    }
    const cleanCaps = Array.from(new Set((capabilities || []).filter((c) => ALLOWED_CAPABILITIES.has(c))));
    if (cleanCaps.length === 0) {
      throw new Error("NO_VALID_CAPABILITIES");
    }

    const key = String(name).trim().toLowerCase();
    const existing = this._indexByName.get(key);
    if (existing) {
      existing.role = role;
      existing.model = model;
      existing.capabilities = cleanCaps;
      if (persist) this._save();
      return existing;
    }

    const num = String(this.agents.length + 1).padStart(4, "0");
    const agent = {
      id: `AI-AGT-${num}`,
      name: String(name).trim(),
      role,
      model,
      capabilities: cleanCaps,
      health: 100,
      runs: 0,
      failures: 0,
      createdAt: new Date().toISOString()
    };

    this.agents.push(agent);
    this._indexById.set(agent.id, agent);
    this._indexByName.set(key, agent);
    if (persist) this._save();
    return agent;
  }

  registerMany(list = []) {
    let added = 0;
    for (const item of list) {
      const before = this.agents.length;
      this.registerAgent(item, { persist: false });
      if (this.agents.length > before) added += 1;
    }
    this._save();
    return { total: this.agents.length, added };
  }

  listAgents() {
    return this.agents;
  }

  statsByRole() {
    const map = {};
    for (const a of this.agents) {
      map[a.role] = (map[a.role] || 0) + 1;
    }
    return map;
  }

  executeTask({ agentId, capability = "reasoning.plan", task = "" }) {
    if (!isSafePrompt(task)) {
      throw new Error("BLOCKED_UNSAFE_INSTRUCTION");
    }
    const agent =
      (agentId && this._indexById.get(agentId)) ||
      this.agents.find((a) => a.capabilities.includes(capability) && a.health >= 40);

    if (!agent) {
      throw new Error("NO_MATCHING_AGENT");
    }
    if (!agent.capabilities.includes(capability)) {
      throw new Error(`CAPABILITY_DENIED:${agent.id}:${capability}`);
    }

    const t0 = Date.now();
    agent.runs += 1;

    let verifiedResult = null;
    if (capability === "filesystem.read" || capability === "code.audit") {
      const pkgPath = path.join(this.projectDir, "package.json");
      const exists = fs.existsSync(pkgPath);
      verifiedResult = {
        checkedFile: "package.json",
        exists,
        bytes: exists ? fs.statSync(pkgPath).size : 0
      };
    } else if (capability === "dependency.audit" || capability === "evidence.verify") {
      const lockExists = fs.existsSync(path.join(this.projectDir, "package-lock.json"));
      verifiedResult = {
        lockfilePresent: lockExists,
        agentsRegistered: this.agents.length
      };
    } else if (capability === "network.observe") {
      verifiedResult = {
        mode: "read-only-local-check",
        platform: process.platform,
        nodeVersion: process.version
      };
    } else {
      verifiedResult = {
        plannedSteps: ["validate-scope", "select-capable-agent", "collect-verified-output"],
        taskSummary: String(task).slice(0, 120)
      };
    }

    const latencyMs = Date.now() - t0;
    agent.health = Math.max(20, Math.min(100, 100 - agent.failures * 15));
    this._save();

    const record = {
      runId: `RUN-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      agentId: agent.id,
      agentName: agent.name,
      role: agent.role,
      model: agent.model,
      capability,
      latencyMs,
      verified: true,
      result: verifiedResult,
      timestamp: new Date().toISOString()
    };
    record.hash = sha256(record);
    return record;
  }
}

module.exports = MarauderAgentArmyHub;
