"use strict";

const { randomUUID } = require("crypto");

class MissionTask {
  constructor({
    id = randomUUID(),
    title,
    type = "general",
    agent = "general",
    status = "waiting",
    dependsOn = [],
    requiresApproval = false,
    result = null
  }) {
    this.id = id;
    this.title = String(title || "Untitled task");
    this.type = String(type || "general");
    this.agent = String(agent || "general");
    this.status = status;
    this.dependsOn = Array.isArray(dependsOn) ? [...dependsOn] : [];
    this.requiresApproval = Boolean(requiresApproval);
    this.result = result;
  }
}

class Mission {
  constructor({
    id = randomUUID(),
    goal,
    priority = "normal",
    status = "pending",
    tasks = [],
    humanApproved = false,
    createdAt = Date.now(),
    metadata = {}
  }) {
    this.id = id;
    this.goal = String(goal || "");
    this.priority = priority;
    this.status = status;
    this.tasks = Array.isArray(tasks) ? tasks : [];
    this.humanApproved = Boolean(humanApproved);
    this.createdAt = createdAt;
    this.metadata = metadata;
  }
}

class AgentSelector {
  constructor(customMap = {}) {
    this.map = {
      architecture: "architect",
      backend: "backend",
      frontend: "frontend",
      security: "security",
      triage: "security",
      monitoring: "sensor-analyst",
      testing: "tester",
      verification: "verifier",
      deployment: "devops",
      general: "general",
      ...customMap
    };
  }

  select(task = {}) {
    if (task.agent && typeof task.agent === "string") {
      return task.agent;
    }
    const key = String(task.type || "general").toLowerCase();
    return this.map[key] || "general";
  }
}

class MissionPlanner {
  constructor(options = {}) {
    this.agentRegistry = options.agentRegistry || null;
    this.agentSelector = options.agentSelector || new AgentSelector(options.roleMap);
    this.aiCore = options.aiCore || null;
    this.missions = new Map();
  }

  buildPlan(goal, options = {}) {
    const cleanGoal = String(goal || "").trim();
    const lower = cleanGoal.toLowerCase();
    const tasks = [];

    const addTask = ({ title, type, dependsOn = [], requiresApproval = false }) => {
      const id = randomUUID();
      const agent = this.agentSelector.select({ type });
      tasks.push(
        new MissionTask({
          id,
          title,
          type,
          agent,
          status: dependsOn.length === 0 ? "ready" : "waiting",
          dependsOn,
          requiresApproval
        })
      );
      return id;
    };

    if (!cleanGoal) {
      return tasks;
    }

    const scopeId = addTask({
      title: `Define scope and constraints for: ${cleanGoal}`,
      type: "architecture",
      requiresApproval: false
    });

    if (lower.includes("website") || lower.includes("web") || lower.includes("сайт")) {
      const archId = addTask({
        title: "Design system architecture and data flow",
        type: "architecture",
        dependsOn: [scopeId]
      });
      const feId = addTask({
        title: "Build frontend interface and user flow",
        type: "frontend",
        dependsOn: [archId]
      });
      const beId = addTask({
        title: "Implement backend API and validation",
        type: "backend",
        dependsOn: [archId]
      });
      const secId = addTask({
        title: "Run security and input boundary review",
        type: "security",
        dependsOn: [feId, beId]
      });
      addTask({
        title: "Verify build and smoke checks",
        type: "verification",
        dependsOn: [secId]
      });
      return tasks;
    }

    if (
      lower.includes("guard") ||
      lower.includes("sensor") ||
      lower.includes("monitor") ||
      lower.includes("radar") ||
      lower.includes("alert") ||
      lower.includes("наблюден") ||
      lower.includes("сензор")
    ) {
      const ingestId = addTask({
        title: "Ingest and normalize telemetry/sensor streams",
        type: "monitoring",
        dependsOn: [scopeId]
      });
      const triageId = addTask({
        title: "Classify anomalies and compute risk score",
        type: "triage",
        dependsOn: [ingestId]
      });
      const alertId = addTask({
        title: "Prepare operator alert and evidence bundle (human approval gate)",
        type: "security",
        dependsOn: [triageId],
        requiresApproval: Boolean(options.requireApprovalForAction)
      });
      addTask({
        title: "Verify audit log and false-positive telemetry",
        type: "verification",
        dependsOn: [alertId]
      });
      return tasks;
    }

    const execId = addTask({
      title: `Execute core work for: ${cleanGoal}`,
      type: options.defaultType || "backend",
      dependsOn: [scopeId]
    });
    const testId = addTask({
      title: "Run verification and consistency checks",
      type: "verification",
      dependsOn: [execId]
    });
    addTask({
      title: "Record final summary and evidence references",
      type: "security",
      dependsOn: [testId]
    });

    return tasks;
  }

  async createMission(goal, options = {}) {
    const mission = new Mission({
      goal,
      priority: options.priority || "normal",
      status: "planning",
      humanApproved: options.humanApproved === true,
      metadata: {
        planner: "MARAUDER-MISSION-PLANNER-v1",
        automaticWeaponsRelease: false
      }
    });

    mission.tasks = this.buildPlan(goal, options);
    mission.status = mission.tasks.length > 0 ? "ready" : "empty";

    if (this.aiCore && typeof this.aiCore.reasonWithGateway === "function" && options.useGateway !== false) {
      const gwSummary = await this.aiCore.reasonWithGateway({
        task: "plan-review",
        prompt: `Review mission plan for goal "${mission.goal}" with ${mission.tasks.length} tasks in 2 concise sentences.`
      });
      mission.metadata.planReview = {
        usedModel: Boolean(gwSummary && gwSummary.usedModel),
        executionMode: gwSummary ? gwSummary.executionMode : "FALLBACK_NO_MODEL",
        model: gwSummary ? gwSummary.model : null,
        notes: gwSummary ? gwSummary.output : ""
      };
    }

    this.missions.set(mission.id, mission);
    return mission;
  }

  getNextRunnableTasks(missionId) {
    const mission = this.missions.get(missionId);
    if (!mission) return [];

    const completedIds = new Set(
      mission.tasks.filter((t) => t.status === "completed").map((t) => t.id)
    );

    return mission.tasks.filter((task) => {
      if (task.status !== "waiting" && task.status !== "ready") return false;
      const depsMet = task.dependsOn.every((depId) => completedIds.has(depId));
      if (!depsMet) return false;
      if (task.requiresApproval && !mission.humanApproved) return false;
      return true;
    });
  }
}

module.exports = {
  Mission,
  MissionTask,
  AgentSelector,
  MissionPlanner
};
