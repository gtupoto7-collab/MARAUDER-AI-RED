"use strict";

const { AgentRouter } = require("./agent-router");

const DEFENSIVE_INCIDENT_AGENTS = new Set([
  "soc-analyst",
  "incident-response",
  "log-analysis",
  "security",
  "sensor-analyst"
]);

class TaskQueue {
  constructor(options = {}) {
    this.executors = { ...(options.executors || {}) };
    this.rootController = options.rootController || null;
    this.memoryFabric = options.memoryFabric || null;
    this.agentRouter = options.agentRouter || new AgentRouter({ memoryFabric: this.memoryFabric });
    this.auditLog = Array.isArray(options.auditLog) ? options.auditLog : [];
  }

  registerExecutor(agentName, fn) {
    if (agentName && typeof fn === "function") {
      this.executors[String(agentName)] = fn;
    }
  }

  logEvent(eventType, payload = {}, actor = "task-queue") {
    const entry = {
      ts: new Date().toISOString(),
      eventType,
      ...payload
    };
    this.auditLog.push(entry);

    if (this.memoryFabric && typeof this.memoryFabric.recordAudit === "function") {
      this.memoryFabric.recordAudit(eventType, payload, actor);
    }
    return entry;
  }

  syncMemoryFromTask(task, mission, outcome, errorMessage = null) {
    if (!this.memoryFabric) return;

    const output = task.result && typeof task.result.output === "object" && task.result.output !== null
      ? task.result.output
      : {};

    const candidateAsset = output.asset || (task.result && task.result.asset) || null;
    if (candidateAsset && typeof this.memoryFabric.upsertAsset === "function") {
      this.memoryFabric.upsertAsset(
        {
          ...candidateAsset,
          metadata: {
            ...(candidateAsset.metadata || {}),
            lastMissionId: mission.id,
            lastTaskId: task.id,
            lastAgent: task.agent
          }
        },
        task.agent || "task-queue"
      );
    }

    const explicitIncident = output.incident || (task.result && task.result.incident) || null;
    if (explicitIncident && typeof this.memoryFabric.recordIncident === "function") {
      this.memoryFabric.recordIncident(
        {
          ...explicitIncident,
          missionId: explicitIncident.missionId || mission.id,
          evidence: [
            ...(Array.isArray(explicitIncident.evidence) ? explicitIncident.evidence : []),
            `mission:${mission.id}`,
            `task:${task.id}`,
            `agent:${task.agent}`
          ]
        },
        task.agent || "soc-analyst"
      );
      return;
    }

    if (
      outcome === "FAILED" &&
      DEFENSIVE_INCIDENT_AGENTS.has(String(task.agent || "")) &&
      typeof this.memoryFabric.recordIncident === "function"
    ) {
      this.memoryFabric.recordIncident(
        {
          title: `Task failed during ${task.agent}: ${task.title}`,
          severity: "high",
          status: "open",
          riskScore: 70,
          source: task.agent,
          missionId: mission.id,
          evidence: [`task:${task.id}`, `error:${errorMessage || "TASK_EXECUTION_FAILED"}`]
        },
        task.agent
      );
    }
  }


  evaluateTaskOutcome(task, { ok, durationMs, output = null, errorMessage = null }) {
    if (!this.agentRouter || typeof this.agentRouter.evaluateFindings !== "function") {
      return null;
    }

    const safeOut = output && typeof output === "object" ? output : {};
    const mt = safeOut.modelTelemetry && typeof safeOut.modelTelemetry === "object"
      ? safeOut.modelTelemetry
      : {};

    const rawFindings = Array.isArray(safeOut.findings)
      ? safeOut.findings
      : Array.isArray(safeOut.evidence)
        ? safeOut.evidence
        : ok
          ? [safeOut.summary || `task:${task.id}`]
          : [];

    const contradictions = Array.isArray(safeOut.contradictions)
      ? safeOut.contradictions
      : [];

    return this.agentRouter.evaluateFindings({
      agent: task.agent || "general",
      findings: rawFindings,
      contradictions,
      latencyMs: durationMs,
      model: mt.model || null,
      executionMode: mt.executionMode || "FALLBACK_NO_MODEL",
      ok
    });
  }

  async runReadyTasks(planner, missionId) {
    if (!planner || typeof planner.getNextRunnableTasks !== "function") {
      throw new Error("VALID_MISSION_PLANNER_REQUIRED");
    }
    const mission = planner.missions.get(missionId);
    if (!mission) {
      throw new Error("MISSION_NOT_FOUND");
    }

    const runnable = planner.getNextRunnableTasks(missionId);
    const executed = [];

    for (const task of runnable) {
      if (task.requiresApproval && !mission.humanApproved) {
        task.status = "held_approval";
        this.logEvent(
          "TASK_HELD_PENDING_HUMAN_APPROVAL",
          {
            missionId: mission.id,
            taskId: task.id,
            agent: task.agent,
            outcome: "HELD_PENDING_HUMAN_APPROVAL"
          },
          task.agent || "task-queue"
        );
        continue;
      }

      if (this.rootController && typeof this.rootController.authorizeAndPrepare === "function") {
        const auth = await this.rootController.authorizeAndPrepare({
          action: "MISSION_TASK_EXECUTION",
          missionId: mission.id,
          taskId: task.id,
          agent: task.agent,
          humanApproved: mission.humanApproved,
          automaticWeaponsRelease: false
        });
        if (!auth || auth.allowed !== true) {
          task.status = "blocked_root";
          this.logEvent(
            "TASK_BLOCKED_BY_ROOT_CONTROLLER",
            {
              missionId: mission.id,
              taskId: task.id,
              agent: task.agent,
              outcome: "BLOCKED_BY_ROOT_CONTROLLER",
              reason: auth && auth.reason ? auth.reason : "NOT_AUTHORIZED"
            },
            "root-controller"
          );
          continue;
        }
      }

      task.status = "running";
      const executor = this.executors[task.agent] || this.executors.general || null;
      const startedAt = Date.now();

      try {
        const output = executor
          ? await executor(task, mission)
          : {
              summary: `Prepared defensive workflow step for ${task.agent}: ${task.title}`,
              evidence: [`task:${task.id}`, `agent:${task.agent}`]
            };
        const durationMs = Math.max(0, Date.now() - startedAt);
        const evaluation = this.evaluateTaskOutcome(task, { ok: true, durationMs, output });

        task.result = {
          ok: true,
          completedAt: Date.now(),
          durationMs,
          output,
          evaluation
        };
        task.status = "completed";
        executed.push(task);

        this.syncMemoryFromTask(task, mission, "COMPLETED");
        this.logEvent(
          "TASK_COMPLETED",
          {
            missionId: mission.id,
            taskId: task.id,
            agent: task.agent,
            outcome: "COMPLETED"
          },
          task.agent || "task-queue"
        );
      } catch (err) {
        const errMsg = err && err.message ? err.message : "TASK_EXECUTION_FAILED";
        const durationMs = Math.max(0, Date.now() - startedAt);
        const evaluation = this.evaluateTaskOutcome(task, { ok: false, durationMs, errorMessage: errMsg });
        task.status = "failed";
        task.result = {
          ok: false,
          durationMs,
          error: errMsg,
          evaluation
        };

        this.syncMemoryFromTask(task, mission, "FAILED", errMsg);
        this.logEvent(
          "TASK_FAILED",
          {
            missionId: mission.id,
            taskId: task.id,
            agent: task.agent,
            outcome: "FAILED",
            error: errMsg
          },
          task.agent || "task-queue"
        );
      }
    }

    const allCompleted = mission.tasks.length > 0 && mission.tasks.every((t) => t.status === "completed");
    const anyFailed = mission.tasks.some((t) => t.status === "failed");
    if (allCompleted) {
      mission.status = "completed";
    } else if (anyFailed) {
      mission.status = "degraded";
    } else {
      mission.status = "in_progress";
    }

    return {
      missionId: mission.id,
      missionStatus: mission.status,
      executedCount: executed.length,
      executed
    };
  }
}


function createGatewayTaskExecutor(options = {}) {
  const aiCore = options.aiCore;
  if (!aiCore || typeof aiCore.reasonWithGateway !== "function") {
    throw new Error("VALID_AI_CORE_WITH_REASON_WITH_GATEWAY_REQUIRED");
  }

  const memoryFabric = options.memoryFabric || null;
  const defaultTimeoutMs = Number(options.timeoutMs || 15000);

  return async function gatewayExecutor(task, mission) {
    const taskKind = options.taskType || task.type || task.agent || "general";
    const prompt = typeof options.buildPrompt === "function"
      ? options.buildPrompt(task, mission)
      : [
          `Mission goal: ${mission && mission.goal ? mission.goal : "N/A"}`,
          `Task: ${task.title} (type=${task.type}, agent=${task.agent})`,
          "Provide a concise, evidence-driven defensive engineering output without authorizing autonomous weapons release."
        ].join("\n");

    const res = await aiCore.reasonWithGateway({
      task: taskKind,
      model: options.model,
      provider: options.provider,
      timeoutMs: options.timeoutMs || defaultTimeoutMs,
      prompt
    });

    const usedModel = Boolean(res && res.usedModel === true);
    const executionMode = usedModel ? "LIVE_MODEL" : "FALLBACK_NO_MODEL";

    const payload = {
      summary: res && res.output
        ? String(res.output).trim()
        : `Fallback output for task: ${task.title}`,
      modelTelemetry: {
        usedModel,
        executionMode,
        provider: res && res.provider ? res.provider : "fallback",
        model: res && res.model ? res.model : null,
        latencyMs: res && typeof res.latencyMs === "number" ? res.latencyMs : 0,
        fallbackReason: usedModel ? null : ((res && res.fallbackReason) || "NO_LIVE_MODEL")
      },
      evidence: [
        `mission:${mission && mission.id ? mission.id : "unknown"}`,
        `task:${task.id}`,
        `agent:${task.agent}`,
        `mode:${executionMode}`
      ]
    };

    if (memoryFabric && typeof memoryFabric.recordAudit === "function") {
      memoryFabric.recordAudit(
        "GATEWAY_TASK_REASONING",
        {
          missionId: mission ? mission.id : null,
          taskId: task.id,
          agent: task.agent,
          usedModel,
          executionMode,
          model: payload.modelTelemetry.model,
          latencyMs: payload.modelTelemetry.latencyMs
        },
        task.agent || "gateway-executor"
      );
    }

    return payload;
  };
}

module.exports = { TaskQueue, createGatewayTaskExecutor };
