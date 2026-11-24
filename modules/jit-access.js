const crypto = require("crypto");

class JitAccessManager {
  constructor(mode = "PRODUCTION") {
    this.mode = String(mode || "PRODUCTION").toUpperCase() === "LAB" ? "LAB" : "PRODUCTION";
    this.leases = new Map();
    this.auditLog = [];
    this.killed = false;
  }

  setMode(newMode, actor = "CEO / FOUNDER") {
    const norm = String(newMode || "").toUpperCase();
    if (norm !== "LAB" && norm !== "PRODUCTION") {
      return { ok: false, error: "Режимът трябва да бъде LAB или PRODUCTION." };
    }
    this.mode = norm;
    this.record(actor, "MODE_CHANGE", `Режимът е зададен на ${this.mode}`);
    return { ok: true, mode: this.mode };
  }

  emergencyKillSwitch(actor = "CEO / FOUNDER", reason = "Активиран Emergency Kill Switch") {
    this.killed = true;
    const revokedIds = [];
    for (const [leaseId, lease] of this.leases.entries()) {
      lease.active = false;
      lease.status = "KILLED";
      lease.revokedAt = new Date().toISOString();
      revokedIds.push(leaseId);
      this.leases.delete(leaseId);
    }
    this.record(actor, "EMERGENCY_KILL_SWITCH", `${reason}; отнети сесии: ${revokedIds.length}`);
    return { ok: true, killed: true, revokedCount: revokedIds.length };
  }

  requestElevation({
    agentName,
    taskName,
    scope = "isolated-lab-vm",
    riskLevel = "medium",
    ttlSeconds = 600,
    humanApproved = false,
    actor = "policy-engine"
  }) {
    if (this.killed) {
      this.record(actor, "DENIED_KILLED", `Опит за достъп от ${agentName} при активен Kill Switch.`);
      return { ok: false, error: "Системата е в състояние EMERGENCY KILL SWITCH." };
    }

    if (!agentName || !taskName || !scope) {
      return { ok: false, error: "Изискват се agentName, taskName и scope." };
    }

    const requiresHumanApproval = this.mode === "PRODUCTION" || String(riskLevel).toLowerCase() === "high";
    if (requiresHumanApproval && !humanApproved) {
      this.record(actor, "APPROVAL_REQUIRED", `${agentName} -> ${taskName} [${scope}] (${this.mode})`);
      return {
        ok: false,
        requiresApproval: true,
        mode: this.mode,
        error: `Режим ${this.mode} изисква изрично одобрение преди временно повишаване на правата.`
      };
    }

    const safeTtlSec = Math.min(Math.max(Number(ttlSeconds) || 600, 10), 3600);
    const leaseId = `JIT-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
    const ephemeralToken = crypto.randomBytes(16).toString("hex");
    const now = Date.now();

    const lease = {
      leaseId,
      agentName: String(agentName),
      taskName: String(taskName),
      scope: String(scope),
      mode: this.mode,
      privilege: "temporary-elevated",
      ephemeralTokenPrefix: ephemeralToken.slice(0, 8),
      grantedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + safeTtlSec * 1000).toISOString(),
      active: true,
      status: "ACTIVE"
    };

    this.leases.set(leaseId, lease);
    this.record(actor, "PRIVILEGE_GRANTED", `${leaseId} за ${agentName} (${taskName}) в обхват ${scope}, TTL=${safeTtlSec}s`);
    return { ok: true, lease };
  }

  revokeAndVerifyCleanup(leaseId, { revertSnapshot = false, actor = "jit-enforcer" } = {}) {
    const key = String(leaseId || "");
    const lease = this.leases.get(key);
    this.leases.delete(key);

    const stillActive = this.leases.has(key);
    const cleanupVerified = !stillActive;

    this.record(
      actor,
      "PRIVILEGE_REVOKED_AND_VERIFIED",
      `${key} отнет; cleanupVerified=${cleanupVerified}; revertSnapshot=${Boolean(revertSnapshot)}`
    );

    return {
      ok: true,
      leaseId: key,
      previousLease: lease || null,
      privilegesRevoked: true,
      cleanupVerified,
      snapshotReverted: Boolean(revertSnapshot)
    };
  }

  record(actor, event, detail) {
    this.auditLog.push({
      ts: new Date().toISOString(),
      actor,
      event,
      detail
    });
  }

  getAuditLog() {
    return this.auditLog.slice();
  }
}

module.exports = { JitAccessManager };
