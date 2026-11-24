const { getAgentEquipment, loadArmoryAgents } = require("./agent-armory");
const { grantTaskRoot, revokeTaskRoot, revokeAllTaskRoot, getActiveRootLeases } = require("./tool-permissions");
const { buildBridgeTask } = require("./local-bridge");

const taskHistory = [];
const auditTrail = [];

function recordAudit(event, detail) {
  auditTrail.push({
    ts: new Date().toISOString(),
    event,
    detail
  });
}

function assignAgentTask(
  agentKey,
  {
    environment = "ubuntu-wsl",
    useRootForTask = true,
    explicitApproval = true,
    ttlMs = 300000,
    summary = ""
  } = {}
) {
  const agent = getAgentEquipment(agentKey);
  if (!agent) {
    return { ok: false, error: `Агент '${agentKey}' не е намерен във въоръжението.` };
  }
  const bridge = buildBridgeTask(environment, agent.slug, summary);
  if (!bridge.ok) return bridge;

  const taskId = `TASK-${taskHistory.length + 1}-${Date.now().toString(36).toUpperCase()}`;
  let rootGranted = false;

  if (useRootForTask) {
    const rootRes = grantTaskRoot({
      taskId,
      agentName: agent.name,
      ttlMs,
      approvedByOperator: Boolean(explicitApproval)
    });
    if (!rootRes.ok) {
      return { ok: false, error: rootRes.error };
    }
    rootGranted = true;
    recordAudit("TASK_ROOT_GRANTED", `${taskId} -> ${agent.name} (${bridge.environment})`);
  }

  const entry = {
    id: taskId,
    startedAt: new Date().toISOString(),
    completedAt: null,
    agent: agent.name,
    model: agent.model,
    tools: agent.tools,
    environment: bridge.environment,
    permissionMode: rootGranted ? "task-root" : "read-only",
    summary: bridge.summary,
    status: "running"
  };
  taskHistory.push(entry);
  recordAudit("TASK_STARTED", `${taskId} [${agent.name}] mode=${entry.permissionMode}`);

  return {
    ok: true,
    task: entry,
    report: `Агент ${agent.name} стартира ${taskId} в ${bridge.environment} с режим ${entry.permissionMode}.`
  };
}

function finishAgentTask(taskId, outcome = "completed") {
  const task = taskHistory.find((t) => t.id === taskId);
  if (!task) {
    return { ok: false, error: `Задача '${taskId}' не е намерена.` };
  }
  const rev = revokeTaskRoot(taskId, `Задача ${taskId} приключи (${outcome}) — root свален към read-only`);
  task.status = outcome;
  task.permissionMode = "read-only";
  task.completedAt = new Date().toISOString();
  recordAudit("TASK_FINISHED_ROOT_REVOKED", `${taskId} -> status=${outcome}, mode=read-only, revoked=${rev.revoked}`);

  return {
    ok: true,
    task,
    revokedRoot: rev.revoked,
    report: `Задача ${taskId} приключи (${outcome}). Root достъпът е отнет и агентът е върнат на read-only.`
  };
}

function emergencyRevokeAll(reason = "Аварийно спиране от оператора") {
  const res = revokeAllTaskRoot(reason);
  for (const t of taskHistory) {
    if (t.status === "running") {
      t.status = "halted";
      t.permissionMode = "read-only";
      t.completedAt = new Date().toISOString();
    }
  }
  recordAudit("EMERGENCY_ROOT_REVOKE_ALL", `${reason} (revoked=${res.revokedCount})`);
  return res;
}

function getTaskHistory() {
  return taskHistory.slice();
}

function getAuditTrail() {
  return auditTrail.slice();
}

module.exports = {
  loadArmoryAgents,
  assignAgentTask,
  finishAgentTask,
  emergencyRevokeAll,
  getActiveRootLeases,
  getTaskHistory,
  getAuditTrail
};
