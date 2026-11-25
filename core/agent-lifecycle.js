"use strict";

const crypto = require("crypto");

const LIFECYCLE_STATES = Object.freeze({
  PROPOSED: "PROPOSED",
  VALIDATING: "VALIDATING",
  VERIFIED: "VERIFIED",
  REGISTERED: "REGISTERED",
  READY: "READY",
  RUNNING: "RUNNING",
  DEGRADED: "DEGRADED",
  QUARANTINED: "QUARANTINED",
  RETIRED: "RETIRED"
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [LIFECYCLE_STATES.PROPOSED]: new Set([
    LIFECYCLE_STATES.VALIDATING,
    LIFECYCLE_STATES.RETIRED
  ]),
  [LIFECYCLE_STATES.VALIDATING]: new Set([
    LIFECYCLE_STATES.VERIFIED,
    LIFECYCLE_STATES.DEGRADED,
    LIFECYCLE_STATES.QUARANTINED,
    LIFECYCLE_STATES.RETIRED
  ]),
  [LIFECYCLE_STATES.VERIFIED]: new Set([
    LIFECYCLE_STATES.REGISTERED,
    LIFECYCLE_STATES.VALIDATING,
    LIFECYCLE_STATES.QUARANTINED,
    LIFECYCLE_STATES.RETIRED
  ]),
  [LIFECYCLE_STATES.REGISTERED]: new Set([
    LIFECYCLE_STATES.READY,
    LIFECYCLE_STATES.DEGRADED,
    LIFECYCLE_STATES.QUARANTINED,
    LIFECYCLE_STATES.RETIRED
  ]),
  [LIFECYCLE_STATES.READY]: new Set([
    LIFECYCLE_STATES.RUNNING,
    LIFECYCLE_STATES.DEGRADED,
    LIFECYCLE_STATES.QUARANTINED,
    LIFECYCLE_STATES.RETIRED
  ]),
  [LIFECYCLE_STATES.RUNNING]: new Set([
    LIFECYCLE_STATES.READY,
    LIFECYCLE_STATES.DEGRADED,
    LIFECYCLE_STATES.QUARANTINED,
    LIFECYCLE_STATES.RETIRED
  ]),
  [LIFECYCLE_STATES.DEGRADED]: new Set([
    LIFECYCLE_STATES.VALIDATING,
    LIFECYCLE_STATES.READY,
    LIFECYCLE_STATES.QUARANTINED,
    LIFECYCLE_STATES.RETIRED
  ]),
  [LIFECYCLE_STATES.QUARANTINED]: new Set([
    LIFECYCLE_STATES.VALIDATING,
    LIFECYCLE_STATES.RETIRED
  ]),
  [LIFECYCLE_STATES.RETIRED]: new Set([])
});

function hashPayload(obj) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(obj))
    .digest("hex");
}

class QuarantineManager {
  constructor(options = {}) {
    this.maxFailuresBeforeQuarantine =
      typeof options.maxFailuresBeforeQuarantine === "number" &&
      options.maxFailuresBeforeQuarantine > 0
        ? options.maxFailuresBeforeQuarantine
        : 3;
    this.quarantined = new Map();
    this.failureCounts = new Map();
  }

  recordFailure(agentId, reason = "UNSPECIFIED_FAILURE", meta = {}) {
    if (!agentId || typeof agentId !== "string") {
      throw new Error("QuarantineManager.recordFailure requires a valid agentId");
    }

    const nextCount = (this.failureCounts.get(agentId) || 0) + 1;
    this.failureCounts.set(agentId, nextCount);

    const shouldQuarantine =
      meta.forceQuarantine === true ||
      nextCount >= this.maxFailuresBeforeQuarantine;

    if (!shouldQuarantine) {
      return {
        agentId,
        quarantined: false,
        failureCount: nextCount,
        threshold: this.maxFailuresBeforeQuarantine,
        reason
      };
    }

    const existing = this.quarantined.get(agentId);
    const record = {
      agentId,
      reason,
      failureCount: nextCount,
      quarantinedAt: existing ? existing.quarantinedAt : new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      proposedOnly: true,
      humanApproved: false,
      meta: { ...meta }
    };

    this.quarantined.set(agentId, record);

    return {
      agentId,
      quarantined: true,
      record: { ...record }
    };
  }

  isQuarantined(agentId) {
    return this.quarantined.has(agentId);
  }

  getRecord(agentId) {
    const rec = this.quarantined.get(agentId);
    return rec ? { ...rec } : null;
  }

  listQuarantined() {
    return Array.from(this.quarantined.values()).map((r) => ({ ...r }));
  }

  releaseFromQuarantine(agentId, releaseMeta = {}) {
    if (!this.quarantined.has(agentId)) {
      return {
        agentId,
        released: false,
        reason: "NOT_IN_QUARANTINE"
      };
    }

    const previous = this.quarantined.get(agentId);
    this.quarantined.delete(agentId);
    this.failureCounts.set(agentId, 0);

    return {
      agentId,
      released: true,
      releasedAt: new Date().toISOString(),
      releaseReason: releaseMeta.reason || "MANUAL_CLEARANCE_FOR_REVALIDATION",
      proposedOnly: true,
      humanApproved: false,
      previousRecord: previous
    };
  }
}

class AgentLifecycle {
  constructor(options = {}) {
    this.memory = options.memory || null;
    this.quarantine =
      options.quarantine instanceof QuarantineManager
        ? options.quarantine
        : new QuarantineManager(options.quarantine || {});
    this.records = new Map();
    this.auditLog = [];
  }

  _recordAudit(eventType, payload) {
    const prevHash =
      this.auditLog.length > 0
        ? this.auditLog[this.auditLog.length - 1].hash
        : "GENESIS_MARAUDER_LIFECYCLE";

    const entry = {
      seq: this.auditLog.length + 1,
      timestamp: new Date().toISOString(),
      eventType,
      proposedOnly: true,
      humanApproved: false,
      prevHash,
      payload
    };
    entry.hash = hashPayload(entry);
    this.auditLog.push(entry);

    if (this.memory && typeof this.memory.appendAudit === "function") {
      try {
        this.memory.appendAudit({
          actor: "AgentLifecycle",
          action: eventType,
          proposedOnly: true,
          humanApproved: false,
          details: payload
        });
      } catch (_) {
        // Keep lifecycle state intact even if optional external audit hook throws
      }
    }

    return entry;
  }

  enrollAgent(agentSpec = {}) {
    const agentId =
      typeof agentSpec.id === "string" && agentSpec.id.trim().length > 0
        ? agentSpec.id.trim()
        : typeof agentSpec.agentId === "string" && agentSpec.agentId.trim().length > 0
          ? agentSpec.agentId.trim()
          : "";

    if (!agentId) {
      throw new Error("AgentLifecycle.enrollAgent requires non-empty id or agentId");
    }

    if (this.records.has(agentId)) {
      return this.getAgentState(agentId);
    }

    const now = new Date().toISOString();
    const entry = {
      agentId,
      name: agentSpec.name || agentId,
      domain: agentSpec.domain || "UNSPECIFIED",
      state: LIFECYCLE_STATES.PROPOSED,
      previousState: null,
      proposedOnly: true,
      humanApproved: false,
      selfActivated: false,
      createdAt: now,
      updatedAt: now,
      history: [
        {
          from: null,
          to: LIFECYCLE_STATES.PROPOSED,
          at: now,
          actor: "SYSTEM_ENROLLMENT",
          reason: "INITIAL_PROPOSAL"
        }
      ]
    };

    this.records.set(agentId, entry);
    this._recordAudit("AGENT_ENROLLED", {
      agentId,
      domain: entry.domain,
      state: entry.state
    });

    return this.getAgentState(agentId);
  }

  canTransition(fromState, toState) {
    const allowed = ALLOWED_TRANSITIONS[fromState];
    return Boolean(allowed && allowed.has(toState));
  }

  transition(agentId, nextState, context = {}) {
    if (!LIFECYCLE_STATES[nextState]) {
      throw new Error(`Unknown lifecycle state: ${nextState}`);
    }

    if (context.selfActivation === true) {
      throw new Error(
        `Self-activation is forbidden for agent ${agentId}; transition requires explicit orchestrator/bench action`
      );
    }

    const record = this.records.get(agentId);
    if (!record) {
      throw new Error(`Agent ${agentId} is not enrolled in AgentLifecycle`);
    }

    if (
      record.state === LIFECYCLE_STATES.QUARANTINED &&
      nextState !== LIFECYCLE_STATES.VALIDATING &&
      nextState !== LIFECYCLE_STATES.RETIRED
    ) {
      throw new Error(
        `Quarantined agent ${agentId} cannot transition directly from QUARANTINED to ${nextState}`
      );
    }

    if (!this.canTransition(record.state, nextState)) {
      throw new Error(
        `Invalid lifecycle transition for ${agentId}: ${record.state} -> ${nextState}`
      );
    }

    const fromState = record.state;
    const now = new Date().toISOString();

    record.previousState = fromState;
    record.state = nextState;
    record.updatedAt = now;
    record.proposedOnly = true;
    record.humanApproved = false;

    record.history.push({
      from: fromState,
      to: nextState,
      at: now,
      actor: context.actor || "MARAUDER_CONTROL_PLANE",
      reason: context.reason || "STATE_TRANSITION"
    });

    this._recordAudit("LIFECYCLE_TRANSITION", {
      agentId,
      from: fromState,
      to: nextState,
      actor: context.actor || "MARAUDER_CONTROL_PLANE",
      reason: context.reason || "STATE_TRANSITION"
    });

    return this.getAgentState(agentId);
  }

  quarantineAgent(agentId, reason = "HEALTH_OR_POLICY_FAILURE", meta = {}) {
    const record = this.records.get(agentId);
    if (!record) {
      throw new Error(`Agent ${agentId} is not enrolled in AgentLifecycle`);
    }

    const qResult = this.quarantine.recordFailure(agentId, reason, {
      ...meta,
      forceQuarantine: true
    });

    const fromState = record.state;
    const now = new Date().toISOString();

    if (fromState !== LIFECYCLE_STATES.QUARANTINED) {
      record.previousState = fromState;
      record.state = LIFECYCLE_STATES.QUARANTINED;
      record.updatedAt = now;
      record.history.push({
        from: fromState,
        to: LIFECYCLE_STATES.QUARANTINED,
        at: now,
        actor: meta.actor || "QUARANTINE_MANAGER",
        reason
      });
    }

    this._recordAudit("AGENT_QUARANTINED", {
      agentId,
      from: fromState,
      to: LIFECYCLE_STATES.QUARANTINED,
      reason,
      quarantineRecord: qResult.record
    });

    return {
      agent: this.getAgentState(agentId),
      quarantine: qResult.record
    };
  }

  reportAgentFailure(agentId, reason = "EXECUTION_OR_HEARTBEAT_ERROR", meta = {}) {
    const record = this.records.get(agentId);
    if (!record) {
      throw new Error(`Agent ${agentId} is not enrolled in AgentLifecycle`);
    }

    const qRes = this.quarantine.recordFailure(agentId, reason, meta);

    if (qRes.quarantined) {
      return this.quarantineAgent(agentId, reason, {
        ...meta,
        actor: "QUARANTINE_MANAGER"
      });
    }

    if (
      record.state !== LIFECYCLE_STATES.QUARANTINED &&
      record.state !== LIFECYCLE_STATES.RETIRED &&
      this.canTransition(record.state, LIFECYCLE_STATES.DEGRADED)
    ) {
      this.transition(agentId, LIFECYCLE_STATES.DEGRADED, {
        actor: "QUARANTINE_MANAGER",
        reason
      });
    }

    return {
      agent: this.getAgentState(agentId),
      quarantine: qRes
    };
  }

  clearQuarantineToValidating(agentId, context = {}) {
    const record = this.records.get(agentId);
    if (!record) {
      throw new Error(`Agent ${agentId} is not enrolled in AgentLifecycle`);
    }

    const releaseRes = this.quarantine.releaseFromQuarantine(agentId, context);
    const updatedAgent = this.transition(agentId, LIFECYCLE_STATES.VALIDATING, {
      actor: context.actor || "QUARANTINE_MANAGER",
      reason: context.reason || "REVALIDATION_AFTER_QUARANTINE"
    });

    this._recordAudit("QUARANTINE_CLEARED_TO_VALIDATING", {
      agentId,
      release: releaseRes,
      state: updatedAgent.state
    });

    return {
      agent: updatedAgent,
      release: releaseRes
    };
  }

  getAgentState(agentId) {
    const rec = this.records.get(agentId);
    if (!rec) return null;
    return {
      ...rec,
      quarantined: this.quarantine.isQuarantined(agentId),
      quarantineRecord: this.quarantine.getRecord(agentId),
      history: rec.history.map((h) => ({ ...h }))
    };
  }

  summary() {
    const counts = {};
    for (const st of Object.values(LIFECYCLE_STATES)) {
      counts[st] = 0;
    }

    for (const rec of this.records.values()) {
      counts[rec.state] = (counts[rec.state] || 0) + 1;
    }

    return {
      total: this.records.size,
      quarantinedCount: this.quarantine.listQuarantined().length,
      proposedOnly: true,
      humanApproved: false,
      byState: counts,
      auditEntries: this.auditLog.length
    };
  }
}

module.exports = {
  LIFECYCLE_STATES,
  ALLOWED_TRANSITIONS,
  QuarantineManager,
  AgentLifecycle
};
