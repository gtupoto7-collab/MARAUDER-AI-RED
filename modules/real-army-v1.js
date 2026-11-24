const { EventEmitter } = require("events");
const crypto = require("crypto");

const LOOP_STAGES = ["DISCOVER", "ANALYZE", "DETECT", "VALIDATE", "REMEDIATE", "VERIFY"];

class RealArmyCore extends EventEmitter {
  constructor({ maxConcurrentJobs = 4 } = {}) {
    super();
    this.maxConcurrentJobs = Math.max(1, Number(maxConcurrentJobs) || 4);
    this.activeCount = 0;
    this.jobs = [];
    this.agents = new Map();
    this.localSystems = new Map();
    this.incidents = [];
    this.emergencyStopped = false;
  }

  registerAgent({ name, role = "security-agent", status = "online", task = "idle" }) {
    const record = {
      name: String(name),
      role: String(role),
      status: String(status),
      currentTask: String(task),
      updatedAt: new Date().toISOString()
    };
    this.agents.set(record.name, record);
    this.emit("agent.updated", record);
    return record;
  }

  updateLocalSystem({ system, online = false, detail = "" }) {
    const record = {
      system: String(system),
      online: Boolean(online),
      detail: String(detail),
      checkedAt: new Date().toISOString()
    };
    this.localSystems.set(record.system, record);
    this.emit("system.status", record);
    return record;
  }

  setEmergencyStop(active, reason = "Ръчно управление от MARAUDER DIRECTOR") {
    this.emergencyStopped = Boolean(active);
    if (this.emergencyStopped) {
      for (const job of this.jobs) {
        if (job.status === "queued" || job.status === "running") {
          job.status = "halted";
          job.finishedAt = new Date().toISOString();
        }
      }
    }
    this.emit("emergency.stop", { active: this.emergencyStopped, reason });
    return { ok: true, emergencyStop: this.emergencyStopped };
  }

  submitJob({
    title,
    agentName = "SOC Agent",
    targetScope = "approved-lab",
    authorizedScope = true,
    elevatedLeaseId = null,
    runner = null
  }) {
    if (this.emergencyStopped) {
      return { ok: false, error: "Системата е спряна с Emergency Stop." };
    }
    if (!authorizedScope) {
      return { ok: false, error: "Задачата е отхвърлена: целта не е в одобрения scope." };
    }

    const job = {
      id: `JOB-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      title: String(title || "Security check"),
      agentName: String(agentName),
      targetScope: String(targetScope),
      stageIndex: 0,
      stage: LOOP_STAGES[0],
      elevatedLeaseId,
      status: "queued",
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      verified: false,
      runner: typeof runner === "function" ? runner : null,
      result: null
    };

    this.jobs.push(job);
    this.emit("job.queued", job);
    this.pumpQueue();
    return { ok: true, job };
  }

  async pumpQueue() {
    if (this.emergencyStopped) return;
    while (this.activeCount < this.maxConcurrentJobs) {
      const nextJob = this.jobs.find((j) => j.status === "queued");
      if (!nextJob) break;

      this.activeCount++;
      nextJob.status = "running";
      nextJob.startedAt = new Date().toISOString();
      this.registerAgent({ name: nextJob.agentName, status: "running", task: nextJob.title });
      this.emit("job.started", nextJob);

      try {
        for (let i = 0; i < LOOP_STAGES.length; i++) {
          if (this.emergencyStopped || nextJob.status === "halted") {
            throw new Error("Прекратено заради Emergency Stop");
          }
          nextJob.stageIndex = i;
          nextJob.stage = LOOP_STAGES[i];
          this.emit("job.stage", { jobId: nextJob.id, stage: nextJob.stage });
        }

        const customOutput = nextJob.runner ? await nextJob.runner(nextJob) : { checked: true };
        nextJob.result = customOutput;
        nextJob.status = "completed";
        nextJob.verified = true;
        nextJob.finishedAt = new Date().toISOString();
        this.registerAgent({ name: nextJob.agentName, status: "online", task: "idle" });
        this.emit("job.completed", nextJob);
      } catch (err) {
        nextJob.status = this.emergencyStopped ? "halted" : "failed";
        nextJob.error = err.message;
        nextJob.finishedAt = new Date().toISOString();
        this.registerAgent({ name: nextJob.agentName, status: "online", task: "idle" });
        this.emit("job.failed", nextJob);
      } finally {
        this.activeCount--;
        if (nextJob.elevatedLeaseId) {
          this.emit("privilege.revoke.requested", { leaseId: nextJob.elevatedLeaseId, jobId: nextJob.id });
        }
      }
    }
  }

  getCommandSummary() {
    const completedJobs = this.jobs.filter((j) => j.status === "completed");
    const criticalFindings = this.incidents.filter((inc) => inc.severity === "critical");
    const onlineAgents = Array.from(this.agents.values()).filter((a) => a.status === "online" || a.status === "running");

    return {
      director: "MARAUDER DIRECTOR",
      emergencyStopped: this.emergencyStopped,
      agentsOnlineCount: onlineAgents.length,
      jobsCompletedCount: completedJobs.length,
      incidentsCount: this.incidents.length,
      criticalFindingsCount: criticalFindings.length,
      systemsMonitoredCount: this.localSystems.size,
      activeAgents: Array.from(this.agents.values()),
      systems: Array.from(this.localSystems.values())
    };
  }
}

module.exports = { RealArmyCore, LOOP_STAGES };
