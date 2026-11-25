"use strict";

const { MissionPlanner } = require("./mission-planner");
const { TaskQueue } = require("./task-queue");
const { MissionVerifier } = require("./mission-verifier");
const { MemoryFabric } = require("./memory-fabric");
const { AgentRouter } = require("./agent-router");

class SecurityControlPlane {
  constructor(options = {}) {
    this.memory = options.memory || new MemoryFabric();
    this.router = options.router || new AgentRouter({ memoryFabric: this.memory });
    this.planner = options.planner || new MissionPlanner({ aiCore: options.aiCore || null });
    this.queue =
      options.queue ||
      new TaskQueue({
        memoryFabric: this.memory,
        agentRouter: this.router,
        rootController: options.rootController || null,
        executors: options.executors || {}
      });
    this.verifier = options.verifier || new MissionVerifier();
    this.plugins = new Map();
  }

  registerPlugin(plugin = {}) {
    if (!plugin || typeof plugin.name !== "string" || !plugin.name.trim()) {
      throw new Error("PLUGIN_NAME_REQUIRED");
    }
    const name = plugin.name.trim();
    if (plugin.agentProfile && typeof plugin.agentProfile === "object") {
      this.router.registerProfile(name, plugin.agentProfile);
    }
    if (typeof plugin.executor === "function") {
      this.queue.registerExecutor(name, plugin.executor);
    }
    const record = {
      name,
      version: String(plugin.version || "1.0.0"),
      domain: String(plugin.domain || "DEFENSE"),
      enabled: plugin.enabled !== false,
      registeredAt: new Date().toISOString()
    };
    this.plugins.set(name, record);
    this.memory.recordAudit("CONTROL_PLANE_PLUGIN_REGISTERED", record, "control-plane");
    return record;
  }

  async executeDefensiveMission(goal, options = {}) {
    const humanApproved = options.humanApproved === true;
    const mission = await this.planner.createMission(goal, {
      ...options,
      humanApproved
    });
    mission.metadata.automaticWeaponsRelease = false;

    const routing = this.router.routeEvent({
      type: options.eventType || "DEFENSIVE_MISSION",
      title: goal,
      tags: Array.isArray(options.tags) ? options.tags : ["defense", "audit"]
    });

    this.memory.upsertMissionState(
      {
        id: mission.id,
        goal: mission.goal,
        status: mission.status,
        humanApproved: mission.humanApproved,
        routedAgents: routing.selectedAgents.map((s) => s.agent)
      },
      "control-plane"
    );

    const maxSteps = Math.max(1, Number(options.maxSteps || 15));
    let steps = 0;
    while (
      mission.status !== "completed" &&
      mission.status !== "degraded" &&
      steps < maxSteps
    ) {
      const batch = await this.queue.runReadyTasks(this.planner, mission.id);
      if (batch.executedCount === 0) break;
      steps += 1;
    }

    const completedCount = mission.tasks.filter((t) => t.status === "completed").length;
    this.memory.upsertMissionState(
      {
        id: mission.id,
        goal: mission.goal,
        status: mission.status,
        progress: `${completedCount}/${mission.tasks.length}`,
        humanApproved: mission.humanApproved
      },
      "control-plane"
    );

    const verification = this.verifier.verify(mission);
    const report = this.memory.storeReport(
      {
        missionId: mission.id,
        title: `Defensive Mission Report: ${mission.goal}`,
        summary: `Completed ${completedCount}/${mission.tasks.length} tasks; status=${mission.status}; verified=${verification.verified}.`,
        verified: verification.verified,
        data: {
          routedAgents: routing.selectedAgents.map((s) => s.agent),
          humanApproved: mission.humanApproved,
          automaticWeaponsRelease: false
        }
      },
      "control-plane"
    );

    return {
      mission,
      routing,
      verification,
      report,
      memory: this.memory.getSnapshot(),
      evaluator: this.router.evaluator.listReports()
    };
  }
}

module.exports = { SecurityControlPlane };
