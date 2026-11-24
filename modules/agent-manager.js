const { getAgentEquipment, loadArmoryAgents } = require("./agent-armory");
const { canExecuteAction } = require("./tool-permissions");
const { buildBridgeTask } = require("./local-bridge");

const taskHistory = [];

function assignAgentTask(agentKey, { environment = "ubuntu-wsl", actionType = "read-only", explicitApproval = false, summary = "" } = {}) {
  const agent = getAgentEquipment(agentKey);
  if (!agent) {
    return { ok: false, error: `Агент '${agentKey}' не е намерен във въоръжението.` };
  }
  const perm = canExecuteAction(actionType, explicitApproval);
  if (!perm.allowed) {
    return { ok: false, agent: agent.name, permission: perm };
  }
  const bridge = buildBridgeTask(environment, agent.slug, summary);
  if (!bridge.ok) return bridge;

  const entry = {
    id: `TASK-${taskHistory.length + 1}`,
    timestamp: new Date().toISOString(),
    agent: agent.name,
    model: agent.model,
    tools: agent.tools,
    environment: bridge.environment,
    permissionMode: perm.mode,
    summary: bridge.summary,
    status: "queued-read-only"
  };
  taskHistory.push(entry);
  return { ok: true, task: entry, report: `Агент ${agent.name} (${agent.tools.join(", ")}) получи задача в ${bridge.environment} [${perm.mode}].` };
}

function getTaskHistory() {
  return taskHistory.slice();
}

module.exports = { loadArmoryAgents, assignAgentTask, getTaskHistory };
