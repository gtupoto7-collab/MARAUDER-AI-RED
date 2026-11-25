"use strict";

const crypto = require("crypto");

function sha256(obj) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(obj))
    .digest("hex");
}

class AgentSupervisor {
  constructor(options = {}) {
    this.lifecycle = options.lifecycle || null;
    this.memory = options.memory || null;
    this.heartbeatTimeoutMs =
      typeof options.heartbeatTimeoutMs === "number" &&
      options.heartbeatTimeoutMs > 0
        ? options.heartbeatTimeoutMs
        : 30000;
    this.defaultTaskTimeoutMs =
      typeof options.defaultTaskTimeoutMs === "number" &&
      options.defaultTaskTimeoutMs > 0
        ? options.defaultTaskTimeoutMs
        : 15000;

    this.agents = new Map();
    this.activeTasks = new Map();
    this.isolatedAgents = new Map();
    this.auditLog = [];
  }

  _appendAudit(eventType, payload) {
    const prevHash =
      this.auditLog.length > 0
        ? this.auditLog[this.auditLog.length - 1].hash
        : "GENESIS_MARAUDER_SUPERVISOR";

    const entry = {
      seq: this.auditLog.length + 1,
      timestamp: new Date().toISOString(),
      eventType,
      proposedOnly: true,
      humanApproved: false,
      prevHash,
      payload
    };
    entry.hash = sha256(entry);
    this.auditLog.push(entry);

    if (this.memory && typeof this.memory.appendAudit === "function") {
      try {
        this.memory.appendAudit({
          actor: "AgentSupervisor",
          action: eventType,
          proposedOnly: true,
          humanApproved: false,
          details: payload
        });
      } catch (_) {
        // Keep supervisor state intact if external memory hook fails
      }
    }

    return entry;
  }

  _ensureAgent(agentId, meta = {}) {
    if (!agentId || typeof agentId !== "string" || agentId.trim().length === 0) {
      throw new Error("AgentSupervisor requires a non-empty agentId");
    }
    const id = agentId.trim();
    if (!this.agents.has(id)) {
      const now = Date.now();
      this.agents.set(id, {
        agentId: id,
        name: meta.name || id,
        domain: meta.domain || "UNSPECIFIED",
        health: "HEALTHY",
        lastHealthReason: "INITIALIZED",
        lastHeartbeatAt: now,
        enrolledAt: new Date(now).toISOString(),
        proposedOnly: true,
        humanApproved: false,
        metrics: {
          tasksStarted: 0,
          tasksCompleted: 0,
          tasksFailed: 0,
          timeoutCount: 0,
          failureCount: 0,
          isolationCount: 0,
          totalLatencyMs: 0,
          lastLatencyMs: null,
          maxLatencyMs: 0,
          avgLatencyMs: 0,
          successRate: 1
        }
      });
    }
    return this.agents.get(id);
  }

  _recomputeMetrics(agentRecord) {
    const m = agentRecord.metrics;
    const finished = m.tasksCompleted + m.tasksFailed;
    m.successRate =
      finished > 0 ? Number((m.tasksCompleted / finished).toFixed(4)) : 1;
    m.avgLatencyMs =
      m.tasksCompleted > 0
        ? Number((m.totalLatencyMs / m.tasksCompleted).toFixed(2))
        : 0;
  }

  registerAgent(agentSpec = {}) {
    const agentId = agentSpec.id || agentSpec.agentId;
    const record = this._ensureAgent(agentId, agentSpec);

    if (this.lifecycle && typeof this.lifecycle.enrollAgent === "function") {
      try {
        this.lifecycle.enrollAgent({
          id: record.agentId,
          name: record.name,
          domain: record.domain
        });
      } catch (_) {
        // Ignore if already enrolled in lifecycle
      }
    }

    this._appendAudit("AGENT_SUPERVISED", {
      agentId: record.agentId,
      domain: record.domain,
      health: record.health
    });

    return this.getAgentMetrics(record.agentId);
  }

  recordHeartbeat(agentId, details = {}) {
    const record = this._ensureAgent(agentId, details);
    const now = Date.now();
    record.lastHeartbeatAt = now;

    if (!this.isolatedAgents.has(record.agentId)) {
      record.health = "HEALTHY";
      record.lastHealthReason = details.reason || "HEARTBEAT_OK";
    }

    return {
      agentId: record.agentId,
      health: record.health,
      isolated: this.isolatedAgents.has(record.agentId),
      lastHeartbeatAt: new Date(now).toISOString()
    };
  }

  trackTaskStart(taskSpec = {}) {
    const taskId =
      typeof taskSpec.taskId === "string" && taskSpec.taskId.trim().length > 0
        ? taskSpec.taskId.trim()
        : `TASK-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    const record = this._ensureAgent(taskSpec.agentId, taskSpec);

    if (this.isolatedAgents.has(record.agentId)) {
      return {
        allowed: false,
        taskId,
        agentId: record.agentId,
        reason: "AGENT_ISOLATED",
        proposedOnly: true,
        humanApproved: false
      };
    }

    const timeoutMs =
      typeof taskSpec.timeoutMs === "number" && taskSpec.timeoutMs > 0
        ? taskSpec.timeoutMs
        : this.defaultTaskTimeoutMs;

    const startedAt = Date.now();
    const taskEntry = {
      taskId,
      agentId: record.agentId,
      missionId: taskSpec.missionId || null,
      capability: taskSpec.capability || null,
      startedAt,
      deadlineAt: startedAt + timeoutMs,
      timeoutMs,
      status: "RUNNING"
    };

    this.activeTasks.set(taskId, taskEntry);
    record.metrics.tasksStarted += 1;

    this._appendAudit("TASK_STARTED", {
      taskId,
      agentId: record.agentId,
      missionId: taskEntry.missionId,
      timeoutMs
    });

    return {
      allowed: true,
      taskId,
      agentId: record.agentId,
      deadlineAt: new Date(taskEntry.deadlineAt).toISOString(),
      proposedOnly: true,
      humanApproved: false
    };
  }

  completeTask(taskId, outcome = {}) {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      return {
        found: false,
        taskId,
        reason: "TASK_NOT_FOUND_OR_ALREADY_CLOSED"
      };
    }

    this.activeTasks.delete(taskId);
    const record = this._ensureAgent(task.agentId);
    const now = Date.now();
    const latencyMs = Math.max(0, now - task.startedAt);
    const ok = outcome.ok !== false && outcome.error == null;

    record.metrics.lastLatencyMs = latencyMs;
    if (latencyMs > record.metrics.maxLatencyMs) {
      record.metrics.maxLatencyMs = latencyMs;
    }

    if (ok) {
      record.metrics.tasksCompleted += 1;
      record.metrics.totalLatencyMs += latencyMs;
      if (!this.isolatedAgents.has(record.agentId)) {
        record.health = "HEALTHY";
        record.lastHealthReason = "TASK_COMPLETED";
      }
      this._recomputeMetrics(record);

      this._appendAudit("TASK_COMPLETED", {
        taskId,
        agentId: record.agentId,
        latencyMs
      });

      return {
        found: true,
        taskId,
        agentId: record.agentId,
        ok: true,
        latencyMs
      };
    }

    record.metrics.tasksFailed += 1;
    record.metrics.failureCount += 1;
    this._recomputeMetrics(record);

    const reason = outcome.reason || outcome.error || "TASK_EXECUTION_ERROR";
    if (!this.isolatedAgents.has(record.agentId)) {
      record.health = "DEGRADED";
      record.lastHealthReason = reason;
    }

    this._appendAudit("TASK_FAILED", {
      taskId,
      agentId: record.agentId,
      latencyMs,
      reason
    });

    if (outcome.isolateOnFailure === true) {
      this.isolateAgent(record.agentId, reason, { taskId });
    }

    return {
      found: true,
      taskId,
      agentId: record.agentId,
      ok: false,
      latencyMs,
      reason
    };
  }

  checkTimeouts(nowMs = Date.now()) {
    const timedOut = [];

    for (const [taskId, task] of this.activeTasks.entries()) {
      if (nowMs > task.deadlineAt) {
        this.activeTasks.delete(taskId);
        const record = this._ensureAgent(task.agentId);
        const elapsedMs = Math.max(0, nowMs - task.startedAt);

        record.metrics.tasksFailed += 1;
        record.metrics.failureCount += 1;
        record.metrics.timeoutCount += 1;
        record.metrics.lastLatencyMs = elapsedMs;
        if (elapsedMs > record.metrics.maxLatencyMs) {
          record.metrics.maxLatencyMs = elapsedMs;
        }
        this._recomputeMetrics(record);

        if (!this.isolatedAgents.has(record.agentId)) {
          record.health = "DEGRADED";
          record.lastHealthReason = `TASK_TIMEOUT:${taskId}`;
        }

        const entry = {
          taskId,
          agentId: task.agentId,
          missionId: task.missionId,
          elapsedMs,
          timeoutMs: task.timeoutMs
        };
        timedOut.push(entry);

        this._appendAudit("TASK_TIMED_OUT", entry);

        if (taskSpecIsolate(task)) {
          this.isolateAgent(task.agentId, `TASK_TIMEOUT:${taskId}`, entry);
        }
      }
    }

    return timedOut;
  }

  checkHealth(nowMs = Date.now()) {
    const results = [];

    for (const record of this.agents.values()) {
      const ageMs = Math.max(0, nowMs - record.lastHeartbeatAt);
      const isIsolated = this.isolatedAgents.has(record.agentId);

      if (isIsolated) {
        record.health = "ISOLATED";
      } else if (ageMs > this.heartbeatTimeoutMs) {
        record.health = "DEGRADED";
        record.lastHealthReason = `STALE_HEARTBEAT:${ageMs}ms`;
      } else {
        record.health = "HEALTHY";
      }

      results.push({
        agentId: record.agentId,
        health: record.health,
        isolated: isIsolated,
        heartbeatAgeMs: ageMs,
        reason: record.lastHealthReason
      });
    }

    return results;
  }

  isolateAgent(agentId, reason = "SUPERVISOR_ISOLATION", meta = {}) {
    const record = this._ensureAgent(agentId, meta);
    const nowIso = new Date().toISOString();
    const alreadyIsolated = this.isolatedAgents.has(record.agentId);

    const isolationRecord = {
      agentId: record.agentId,
      reason,
      isolatedAt: alreadyIsolated
        ? this.isolatedAgents.get(record.agentId).isolatedAt
        : nowIso,
      lastUpdatedAt: nowIso,
      proposedOnly: true,
      humanApproved: false,
      meta: { ...meta }
    };

    this.isolatedAgents.set(record.agentId, isolationRecord);
    record.health = "ISOLATED";
    record.lastHealthReason = reason;

    if (!alreadyIsolated) {
      record.metrics.isolationCount += 1;
    }

    if (this.lifecycle && typeof this.lifecycle.quarantineAgent === "function") {
      try {
        this.lifecycle.quarantineAgent(record.agentId, reason, {
          ...meta,
          actor: "AgentSupervisor"
        });
      } catch (_) {
        // Ignore if agent is not yet enrolled or already quarantined
      }
    }

    this._appendAudit("AGENT_ISOLATED", {
      agentId: record.agentId,
      reason,
      isolationRecord
    });

    return {
      isolated: true,
      record: { ...isolationRecord }
    };
  }

  releaseIsolation(agentId, releaseMeta = {}) {
    const record = this._ensureAgent(agentId);
    if (!this.isolatedAgents.has(record.agentId)) {
      return {
        agentId: record.agentId,
        released: false,
        reason: "AGENT_NOT_ISOLATED"
      };
    }

    const previous = this.isolatedAgents.get(record.agentId);
    this.isolatedAgents.delete(record.agentId);
    record.health = "HEALTHY";
    record.lastHealthReason = releaseMeta.reason || "ISOLATION_RELEASED";
    record.lastHeartbeatAt = Date.now();

    if (
      this.lifecycle &&
      typeof this.lifecycle.clearQuarantineToValidating === "function"
    ) {
      try {
        this.lifecycle.clearQuarantineToValidating(record.agentId, {
          actor: "AgentSupervisor",
          reason: releaseMeta.reason || "RELEASED_BY_SUPERVISOR"
        });
      } catch (_) {
        // Ignore if lifecycle transition is not applicable
      }
    }

    this._appendAudit("AGENT_ISOLATION_RELEASED", {
      agentId: record.agentId,
      releaseReason: releaseMeta.reason || "ISOLATION_RELEASED",
      previous
    });

    return {
      agentId: record.agentId,
      released: true,
      releasedAt: new Date().toISOString(),
      proposedOnly: true,
      humanApproved: false,
      previous
    };
  }

  getAgentMetrics(agentId) {
    const record = this.agents.get(agentId);
    if (!record) return null;

    const activeCount = Array.from(this.activeTasks.values()).filter(
      (t) => t.agentId === record.agentId
    ).length;

    return {
      agentId: record.agentId,
      name: record.name,
      domain: record.domain,
      health: record.health,
      lastHealthReason: record.lastHealthReason,
      isolated: this.isolatedAgents.has(record.agentId),
      isolationRecord: this.isolatedAgents.get(record.agentId)
        ? { ...this.isolatedAgents.get(record.agentId) }
        : null,
      activeTasksCount: activeCount,
      proposedOnly: true,
      humanApproved: false,
      metrics: { ...record.metrics }
    };
  }

  getSummary() {
    let healthy = 0;
    let degraded = 0;
    let isolated = 0;

    for (const record of this.agents.values()) {
      if (this.isolatedAgents.has(record.agentId) || record.health === "ISOLATED") {
        isolated += 1;
      } else if (record.health === "DEGRADED") {
        degraded += 1;
      } else {
        healthy += 1;
      }
    }

    return {
      totalAgents: this.agents.size,
      healthy,
      degraded,
      isolated,
      activeTasks: this.activeTasks.size,
      auditEntries: this.auditLog.length,
      proposedOnly: true,
      humanApproved: false
    };
  }
}

function taskSpecIsolate(task) {
  return Boolean(task && task.isolateOnTimeout === true);
}

module.exports = {
  AgentSupervisor
};
