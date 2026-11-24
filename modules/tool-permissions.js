const fs = require("fs");
const path = require("path");

const PERMS_PATH = path.join(__dirname, "..", "data", "permissions.json");

function loadPermissionsPolicy() {
  if (!fs.existsSync(PERMS_PATH)) {
    return {
      defaultMode: "read-only",
      requireExplicitApprovalFor: ["system-modification", "device-blocking", "administrative-action", "active-network-test"],
      rootAccessPolicy: "denied-by-default-per-agent",
      auditLogRequired: true
    };
  }
  return JSON.parse(fs.readFileSync(PERMS_PATH, "utf8"));
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
      reason: `Действието '${actionType}' изисква изрично одобрение и не допуска автоматичен root достъп.`
    };
  }
  return { allowed: true, mode: "approved-scoped", reason: `Действието '${actionType}' е изрично одобрено в ограничен обхват.` };
}

module.exports = { loadPermissionsPolicy, canExecuteAction };
