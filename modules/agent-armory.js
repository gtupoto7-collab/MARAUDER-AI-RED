const fs = require("fs");
const path = require("path");
const { loadPermissionsPolicy } = require("./tool-permissions");

const AGENTS_PATH = path.join(__dirname, "..", "data", "agent-registry.json");

function loadArmoryAgents() {
  if (!fs.existsSync(AGENTS_PATH)) return { system: "MARAUDER AI ARMY", agents: [] };
  return JSON.parse(fs.readFileSync(AGENTS_PATH, "utf8"));
}

function getAgentEquipment(agentNameOrSlug) {
  const data = loadArmoryAgents();
  const policy = loadPermissionsPolicy();
  const key = String(agentNameOrSlug || "").trim().toLowerCase();
  const agent = (data.agents || []).find(
    (a) => String(a.name).toLowerCase() === key || String(a.slug).toLowerCase() === key || String(a.id) === key
  );
  if (!agent) return null;
  return {
    ...agent,
    sandbox: "isolated-agent-workspace",
    policyDefaultMode: policy.defaultMode,
    historyCount: 0
  };
}

module.exports = { loadArmoryAgents, getAgentEquipment };
