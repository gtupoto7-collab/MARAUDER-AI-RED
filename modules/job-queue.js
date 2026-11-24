const jobs = [];
const auditLog = [];
let emergencyStop = false;

function recordAudit(actor, action, detail) {
  const entry = { ts: new Date().toISOString(), actor, action, detail };
  auditLog.push(entry);
  return entry;
}

function enqueueJob({ adapter = "wsl", action = "status-check", approved = false, actor = "CEO / FOUNDER" } = {}) {
  if (emergencyStop) {
    const entry = recordAudit(actor, "JOB_BLOCKED_ESTOP", `Опит за задача '${action}' на '${adapter}' при активен EMERGENCY STOP.`);
    return { ok: false, blocked: true, audit: entry, error: "EMERGENCY STOP е активен." };
  }

  const requiresApproval = action !== "status-check" && action !== "tool-inventory";
  if (requiresApproval && !approved) {
    const entry = recordAudit(actor, "JOB_PENDING_APPROVAL", `Задачата '${action}' на '${adapter}' чака одобрение.`);
    return { ok: false, needsApproval: true, audit: entry, error: "Изисква се изрично одобрение за това действие." };
  }

  const job = {
    id: `JOB-${jobs.length + 1}`,
    createdAt: new Date().toISOString(),
    adapter,
    action,
    status: "queued"
  };
  jobs.push(job);
  recordAudit(actor, "JOB_QUEUED", `${job.id} (${adapter}: ${action})`);
  return { ok: true, job };
}

function setEmergencyStopState(active, actor = "CEO / FOUNDER") {
  emergencyStop = Boolean(active);
  const audit = recordAudit(actor, emergencyStop ? "EMERGENCY_STOP_ON" : "EMERGENCY_STOP_OFF", `Статус на аварийния стоп: ${emergencyStop}`);
  return { ok: true, emergencyStop, audit };
}

function getQueueSnapshot() {
  return {
    emergencyStop,
    jobsCount: jobs.length,
    jobs: jobs.slice(-20),
    auditLog: auditLog.slice(-30)
  };
}

module.exports = { enqueueJob, setEmergencyStopState, getQueueSnapshot };
