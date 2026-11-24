const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const FULL_TOOLSET = Object.freeze([
  { id: "nmap", category: "network.observe", destructive: false, requiresApproval: false },
  { id: "semgrep", category: "code.audit", destructive: false, requiresApproval: false },
  { id: "trivy", category: "dependency.audit", destructive: false, requiresApproval: false },
  { id: "gitleaks", category: "secrets.scan", destructive: false, requiresApproval: false },
  { id: "yara", category: "malware.scan", destructive: false, requiresApproval: false },
  { id: "nuclei", category: "vuln.scan", destructive: false, requiresApproval: true },
  { id: "ollama", category: "llm.local", destructive: false, requiresApproval: false }
]);

const ALLOWED_SCOPES = new Set([
  "approved-project",
  "verified-local-lab",
  "localhost",
  "127.0.0.1"
]);

function sha256(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function hasInjectionSignal(text) {
  return /(ignore\s+(all\s+)?(previous|prior|above)\s+instructions|system\s*prompt|jailbreak|игнорирай\s+(всички\s+)?(предишни|горни)\s+(инструкции|правила))/i.test(
    String(text || "")
  );
}

class RootAgentController {
  constructor(projectDir = process.cwd()) {
    this.projectDir = projectDir;
    this.auditPath = path.join(projectDir, "data", "root-agents", "audit.jsonl");
    fs.mkdirSync(path.dirname(this.auditPath), { recursive: true });
  }

  createRootAgent({
    id = "ROOT-AGT-001",
    callsign = "MARAUDER-ROOT-VANGUARD",
    division = "MARAUDER CYBER INTELLIGENCE",
    model = "ollama:llama3.2",
    tools = FULL_TOOLSET.map((t) => t.id)
  } = {}) {
    const allowedIds = new Set(FULL_TOOLSET.map((t) => t.id));
    const activeTools = Array.from(new Set((tools || []).filter((t) => allowedIds.has(t))));

    return {
      id,
      callsign,
      rankBadge: "ROOT",
      clearance: "SOVEREIGN_COMMAND",
      division,
      model,
      tools: activeTools,
      toolCount: activeTools.length,
      osRootEscalation: false, // Няма неконтролиран root върху хоста по подразбиране
      status: "ONLINE"
    };
  }

  dispatchTool({
    agent,
    toolId,
    target = "",
    scope = "approved-project",
    approved = false,
    prompt = ""
  } = {}) {
    if (!agent || agent.rankBadge !== "ROOT") {
      throw new Error("ROOT_AGENT_REQUIRED");
    }
    if (hasInjectionSignal(prompt) || hasInjectionSignal(target)) {
      throw new Error("BLOCKED_PROMPT_INJECTION");
    }
    if (!ALLOWED_SCOPES.has(scope)) {
      throw new Error(`SCOPE_NOT_ALLOWED:${scope}`);
    }
    if (!agent.tools.includes(toolId)) {
      throw new Error(`TOOL_NOT_ASSIGNED:${toolId}`);
    }

    const meta = FULL_TOOLSET.find((t) => t.id === toolId);
    if (meta && meta.requiresApproval && !approved) {
      return {
        ok: false,
        status: "APPROVAL_REQUIRED",
        agentId: agent.id,
        rankBadge: agent.rankBadge,
        toolId,
        scope,
        reason: `Инструментът '${toolId}' изисква изрично одобрение (approved: true) в разрешен обхват.`
      };
    }

    const entry = {
      eventId: `EVT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      agentId: agent.id,
      callsign: agent.callsign,
      rankBadge: agent.rankBadge,
      toolId,
      category: meta ? meta.category : "custom",
      target: String(target || path.basename(this.projectDir)).slice(0, 200),
      scope,
      approved: Boolean(approved),
      executedAt: new Date().toISOString()
    };
    entry.hash = sha256(entry);

    fs.appendFileSync(this.auditPath, `${JSON.stringify(entry)}\n`);

    return {
      ok: true,
      status: "DISPATCHED_GUARDED",
      entry
    };
  }
}

module.exports = { RootAgentController, FULL_TOOLSET };
