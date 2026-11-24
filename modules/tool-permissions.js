const fs = require("fs");
const path = require("path");

const PERMS_PATH = path.join(__dirname, "..", "data", "permissions.json");
const activeRootLeases = new Map();

function loadPermissionsPolicy() {
  if (!fs.existsSync(PERMS_PATH)) {
    return {
      defaultMode: "read-only",
      requireExplicitApprovalFor: [
        "system-modification",
        "device-blocking",
        "administrative-action",
        "active-network-test"
      ],
      rootAccessPolicy: "scoped-task-lease-auto-revoke",
      auditLogRequired: true
    };
  }
  return JSON.parse(fs.readFileSync(PERMS_PATH, "utf8"));
}

function grantTaskRoot({ taskId, agentName, ttlMs = 300000, approvedByOperator = true }) {
  if (!taskId || !agentName) {
    return { ok: false, error: "Изисква се taskId и agentName за временен root." };
  }
  if (!approvedByOperator) {
    return { ok: false, error: "Временният root изисква изрично потвърждение при изпращане на задачата." };
  }
  const safeTtl = Math.min(Math.max(Number(ttlMs) || 300000, 1000), 3600000);
  const lease = {
    taskId: String(taskId),
    agentName: String(agentName),
    mode: "task-root",
    grantedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + safeTtl).toISOString(),
    active: true
  };
  activeRootLeases.set(String(taskId), lease);
  return { ok: true, lease };
}

function revokeTaskRoot(taskId, reason = "Операцията приключи — root правата са отнети") {
  const key = String(taskId || "");
  const existing = activeRootLeases.get(key);
  activeRootLeases.delete(key);
  return {
    ok: true,
    taskId: key,
    revoked: Boolean(existing),
    mode: "read-only",
    reason
  };
}

function revokeAllTaskRoot(reason = "Аварийно отнемане на всички временни root права") {
  const count = activeRootLeases.size;
  activeRootLeases.clear();
  return { ok: true, revokedCount: count, mode: "read-only", reason };
}

function getActiveRootLeases() {
  const now = Date.now();
  const list = [];
  for (const [taskId, lease] of activeRootLeases.entries()) {
    if (Date.parse(lease.expiresAt) <= now) {
      activeRootLeases.delete(taskId);
    } else {
      list.push({ taskId, ...lease });
    }
  }
  return list;
}

function canExecuteAction(actionType = "read-only", explicitApproval = false) {
  const policy = loadPermissionsPolicy();
  if (actionType === "read-only") {
    return { allowed: true, mode: "read-only", reason: "Стандартни read-only права са разрешени." };
  }
  const needsApproval = (policy.requireExplicitApprovalFor || []).includes(actionType);
  if (needsApproval && !explicitApproval) {
    return {
      allowed: false,
      mode: policy.defaultMode || "read-only",
      reason: `Действието '${actionType}' изисква изрично разрешение при стартиране на задачата.`
    };
  }
  return { allowed: true, mode: "approved-scoped", reason: `Действието '${actionType}' е разрешено за текущата задача.` };
}

module.exports = {
  loadPermissionsPolicy,
  grantTaskRoot,
  revokeTaskRoot,
  revokeAllTaskRoot,
  getActiveRootLeases,
  canExecuteAction
};
