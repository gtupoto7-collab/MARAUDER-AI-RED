const fs = require("fs");
const path = require("path");

const CATALOG_PATH = path.join(__dirname, "..", "data", "marauder-500-agents.json");
const AUDIT_PATH = path.join(__dirname, "..", "data", "marauder-500-audit.log");

class Marauder500Army {
  constructor(ollamaUrl = process.env.OLLAMA_URL || "http://127.0.0.1:11434", model = process.env.OLLAMA_MODEL || "llama3.2") {
    this.ollamaUrl = ollamaUrl;
    this.model = model;
    const raw = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
    this.agents = raw.agents;
    this.byId = new Map(this.agents.map((a) => [a.id, a]));
    this.byName = new Map(this.agents.map((a) => [a.name.toLowerCase(), a]));
  }

  resolveAgent(query) {
    if (!query) return this.byId.get(500);
    const num = Number(query);
    if (Number.isInteger(num) && this.byId.has(num)) return this.byId.get(num);
    const clean = String(query).trim().toLowerCase().replace(/^mrd-0*/, "");
    const cleanNum = Number(clean);
    if (Number.isInteger(cleanNum) && this.byId.has(cleanNum)) return this.byId.get(cleanNum);
    return this.byName.get(String(query).trim().toLowerCase()) || null;
  }

  listAgents({ division = "", search = "", limit = 50, offset = 0 } = {}) {
    let list = this.agents;
    if (division) {
      const d = division.toLowerCase();
      list = list.filter((a) => a.division.toLowerCase().includes(d));
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((a) => a.name.toLowerCase().includes(s) || a.code.toLowerCase().includes(s));
    }
    return {
      totalFiltered: list.length,
      totalCatalog: this.agents.length,
      items: list.slice(Number(offset) || 0, (Number(offset) || 0) + (Number(limit) || 50))
    };
  }

  logAudit(entry) {
    fs.appendFileSync(AUDIT_PATH, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
  }

  async dispatch({ agentIdOrName, task, approved = false, context = {} }) {
    const agent = this.resolveAgent(agentIdOrName);
    if (!agent) {
      return { ok: false, error: `Agent not found: ${agentIdOrName}` };
    }
    if (!task || !String(task).trim()) {
      return { ok: false, error: "Task is required" };
    }

    if (agent.requiresApproval && !approved) {
      const decision = {
        ok: false,
        status: "APPROVAL_REQUIRED",
        agent,
        policy: "JIT_POLICY_GATE",
        message: `${agent.code} (${agent.name}) requires explicit JIT/policy approval before execution.`
      };
      this.logAudit({ agentId: agent.id, code: agent.code, status: "APPROVAL_REQUIRED", task });
      return decision;
    }

    const res = await fetch(`${this.ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        system: agent.systemPrompt,
        prompt: `Context: ${JSON.stringify(context)}\nTask: ${task}`,
        stream: false
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      this.logAudit({ agentId: agent.id, code: agent.code, status: "OLLAMA_ERROR", error: errText });
      return { ok: false, error: `Ollama error (${res.status}): ${errText}` };
    }

    const data = await res.json();
    const output = {
      ok: true,
      status: "EXECUTED",
      model: this.model,
      agent,
      scopeEnforced: agent.leastPrivilegeScope,
      reply: data.response || ""
    };
    this.logAudit({ agentId: agent.id, code: agent.code, status: "EXECUTED", model: this.model, task });
    return output;
  }
}

module.exports = Marauder500Army;
