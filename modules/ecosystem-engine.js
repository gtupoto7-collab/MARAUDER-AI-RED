const fs = require("fs");
const path = require("path");

const CORE_PATH = path.join(__dirname, "..", "data", "ecosystem-core.json");

function loadEcosystem() {
  if (!fs.existsSync(CORE_PATH)) {
    return {
      ecosystem: "MARAUDER AI — AUTONOMOUS CYBER DEFENSE ECOSYSTEM",
      autonomousArmy: [],
      radarSources: [],
      localTargets: []
    };
  }
  return JSON.parse(fs.readFileSync(CORE_PATH, "utf8"));
}

function createAgentBlueprint({ name, specialization, model = "Local / API", tools = [], memory = true, permissions = "Read-only", task = "" }) {
  const cleanName = String(name || "").trim().toUpperCase();
  if (!cleanName) {
    return { ok: false, error: "Изисква се име на агента (напр. PHANTOM-X)." };
  }
  return {
    ok: true,
    agent: {
      id: `AGT-${Date.now().toString(36).toUpperCase()}`,
      name: cleanName,
      specialization: String(specialization || "Network Security").trim(),
      model: String(model || "Local / API").trim(),
      tools: Array.isArray(tools) ? tools : String(tools || "").split(",").map((s) => s.trim()).filter(Boolean),
      memory: Boolean(memory),
      permissions: String(permissions || "Read-only").trim(),
      task: String(task || "Analyze anomalies").trim(),
      sandboxed: true,
      rootAccess: false
    }
  };
}

module.exports = {
  loadEcosystem,
  createAgentBlueprint
};
