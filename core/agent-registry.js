"use strict";

function normalizeTaskType(taskType) {
  return String(taskType || "").trim().toLowerCase();
}

class BaseDefensiveAgent {
  constructor(options = {}) {
    if (!options.id || typeof options.id !== "string" || !options.id.trim()) {
      throw new Error("AGENT_ID_REQUIRED");
    }
    this.id = options.id.trim();
    this.name = String(options.name || this.id).trim();
    this.version = String(options.version || "1.0.0").trim();
    this.domain = String(options.domain || "SOC").trim();
    this.capabilities = Array.isArray(options.capabilities)
      ? options.capabilities.map((c) => normalizeTaskType(c)).filter(Boolean)
      : [];
    this.supportedTaskTypes = Array.isArray(options.supportedTaskTypes)
      ? options.supportedTaskTypes.map((t) => normalizeTaskType(t)).filter(Boolean)
      : [...this.capabilities];
    this.defaultTaskType = normalizeTaskType(
      options.defaultTaskType || this.supportedTaskTypes[0] || "warfare-triage"
    );
    this.requiresApproval = options.requiresApproval === true;
    this.status = options.status || "healthy";
  }

  canHandle(taskType) {
    const normalized = normalizeTaskType(taskType);
    if (!normalized) return false;
    if (this.supportedTaskTypes.includes("*")) return true;
    return (
      this.supportedTaskTypes.includes(normalized) ||
      this.capabilities.includes(normalized)
    );
  }

  async health() {
    return {
      agentId: this.id,
      name: this.name,
      version: this.version,
      domain: this.domain,
      status: this.status === "offline" || this.status === "degraded" ? this.status : "healthy",
      checkedAt: new Date().toISOString()
    };
  }

  async _executeDefensive(task, context = {}) {
    return {
      success: true,
      summary: `${this.name} produced defensive assessment for task ${task && task.id ? task.id : "unknown"}.`,
      findings: [],
      recommendations: [],
      metadata: {
        agentId: this.id,
        domain: this.domain,
        contextKeys: Object.keys(context || {})
      }
    };
  }

  async execute(task = {}, context = {}) {
    const taskType = normalizeTaskType(task && (task.type || task.role));
    if (taskType && !this.canHandle(taskType)) {
      throw new Error(`AGENT_${this.id}_CANNOT_HANDLE_${taskType.toUpperCase()}`);
    }

    const raw = await this._executeDefensive(task, context);
    const result = {
      success: raw && raw.success !== false,
      agentId: this.id,
      agentName: this.name,
      summary: String((raw && raw.summary) || ""),
      findings: Array.isArray(raw && raw.findings) ? raw.findings : [],
      recommendations: Array.isArray(raw && raw.recommendations) ? raw.recommendations : [],
      proposedOnly: true,
      requiresApproval: this.requiresApproval,
      metadata: {
        ...(raw && typeof raw.metadata === "object" ? raw.metadata : {}),
        agentVersion: this.version,
        domain: this.domain,
        humanApprovedDefault: false
      }
    };

    if (context && context.memory && typeof context.memory.recordAudit === "function") {
      context.memory.recordAudit(
        "DEFENSIVE_AGENT_EXECUTED",
        {
          agentId: this.id,
          taskId: task && task.id ? task.id : null,
          taskType: taskType || null,
          success: result.success,
          findingsCount: result.findings.length,
          requiresApproval: result.requiresApproval
        },
        this.id
      );
    }

    return result;
  }
}

function validateAgentContract(agent) {
  if (!agent || typeof agent !== "object") {
    throw new Error("INVALID_AGENT_INSTANCE");
  }
  if (typeof agent.id !== "string" || !agent.id.trim()) {
    throw new Error("AGENT_ID_MISSING");
  }
  if (typeof agent.canHandle !== "function") {
    throw new Error("AGENT_CAN_HANDLE_METHOD_MISSING");
  }
  if (typeof agent.execute !== "function") {
    throw new Error("AGENT_EXECUTE_METHOD_MISSING");
  }
  if (typeof agent.health !== "function") {
    throw new Error("AGENT_HEALTH_METHOD_MISSING");
  }
}

class AgentRegistry {
  constructor(options = {}) {
    this.agents = new Map();
    this.memory = options.memory || null;
  }

  register(agent) {
    validateAgentContract(agent);
    const id = agent.id.trim();
    this.agents.set(id, agent);

    if (this.memory && typeof this.memory.recordAudit === "function") {
      this.memory.recordAudit(
        "AGENT_REGISTERED",
        {
          agentId: id,
          name: agent.name || id,
          version: agent.version || "1.0.0",
          domain: agent.domain || "DEFENSE",
          requiresApproval: agent.requiresApproval === true
        },
        "agent-registry"
      );
    }

    return agent;
  }

  unregister(agentId) {
    const id = String(agentId || "").trim();
    const existed = this.agents.delete(id);

    if (existed && this.memory && typeof this.memory.recordAudit === "function") {
      this.memory.recordAudit("AGENT_UNREGISTERED", { agentId: id }, "agent-registry");
    }

    return existed;
  }

  get(agentId) {
    const id = String(agentId || "").trim();
    return this.agents.get(id) || null;
  }

  list() {
    return Array.from(this.agents.values());
  }

  findForTask(taskType) {
    const normalized = normalizeTaskType(taskType);
    if (!normalized) return [];
    return this.list().filter((agent) => {
      try {
        return agent.canHandle(normalized) === true;
      } catch (_) {
        return false;
      }
    });
  }

  async healthCheckAll() {
    const entries = this.list();
    const checks = [];
    for (const agent of entries) {
      try {
        const h = await agent.health();
        checks.push({
          agentId: agent.id,
          ok: true,
          health: h
        });
      } catch (err) {
        checks.push({
          agentId: agent.id,
          ok: false,
          error: err && err.message ? err.message : "HEALTH_CHECK_FAILED"
        });
      }
    }
    return {
      total: entries.length,
      healthyCount: checks.filter((c) => c.ok && c.health && c.health.status === "healthy").length,
      checks
    };
  }
}

function attachAgentRegistryToControlPlane(controlPlane, registry) {
  if (!controlPlane || !registry || typeof registry.list !== "function") {
    throw new Error("VALID_CONTROL_PLANE_AND_REGISTRY_REQUIRED");
  }

  controlPlane.agentRegistry = registry;
  if (!registry.memory && controlPlane.memory) {
    registry.memory = controlPlane.memory;
  }

  const agents = registry.list();
  for (const agent of agents) {
    if (controlPlane.router && typeof controlPlane.router.registerProfile === "function") {
      controlPlane.router.registerProfile(agent.id, {
        domain: agent.domain || "DEFENSE",
        capabilities: Array.isArray(agent.capabilities) && agent.capabilities.length > 0
          ? agent.capabilities
          : ["defense", "audit"],
        defaultTaskType: agent.defaultTaskType || "warfare-triage",
        requiresApproval: agent.requiresApproval === true
      });
    }

    if (controlPlane.queue && typeof controlPlane.queue.registerExecutor === "function") {
      const taskTypes = new Set([
        ...(Array.isArray(agent.supportedTaskTypes) ? agent.supportedTaskTypes : []),
        ...(Array.isArray(agent.capabilities) ? agent.capabilities : []),
        agent.defaultTaskType || "warfare-triage"
      ]);

      for (const rawType of taskTypes) {
        const tType = normalizeTaskType(rawType);
        if (!tType || tType === "*") continue;

        controlPlane.queue.registerExecutor(tType, async (task, mission) => {
          return agent.execute(task, {
            mission,
            memory: controlPlane.memory || null,
            controlPlane
          });
        });
      }
    }
  }

  if (controlPlane.memory && typeof controlPlane.memory.recordAudit === "function") {
    controlPlane.memory.recordAudit(
      "AGENT_REGISTRY_ATTACHED_TO_CONTROL_PLANE",
      {
        attachedAgentsCount: agents.length,
        agentIds: agents.map((a) => a.id)
      },
      "control-plane"
    );
  }

  return {
    ok: true,
    attachedAgentsCount: agents.length,
    agentIds: agents.map((a) => a.id)
  };
}

module.exports = {
  BaseDefensiveAgent,
  AgentRegistry,
  validateAgentContract,
  attachAgentRegistryToControlPlane
};
