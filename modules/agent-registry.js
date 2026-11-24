const CAPABILITY_REGISTRY = Object.freeze([
  "filesystem.read",
  "network.observe",
  "dependency.audit",
  "tls.inspect",
  "config.audit",
  "evidence.verify"
]);

class AgentRegistry {
  constructor(initialAgents = null) {
    this.capabilityRegistry = CAPABILITY_REGISTRY;
    const defaults = initialAgents || [
      { id: "agent-001", name: "Discovery & FS Scout", version: "2.0.0", capabilities: ["filesystem.read", "config.audit"] },
      { id: "agent-002", name: "Network & Socket Observer", version: "2.0.0", capabilities: ["network.observe", "tls.inspect"] },
      { id: "agent-003", name: "Dependency & Supply Auditor", version: "2.0.0", capabilities: ["dependency.audit", "config.audit"] },
      { id: "agent-004", name: "Evidence & Reality Verifier", version: "2.0.0", capabilities: ["evidence.verify", "filesystem.read"] }
    ];

    this.agents = defaults.map((a) => ({
      id: a.id,
      name: a.name,
      version: a.version || "2.0.0",
      capabilities: (a.capabilities || []).filter((c) => CAPABILITY_REGISTRY.includes(c)),
      status: "IDLE",
      health: 100,
      successRate: 100,
      avgLatency: 0,
      failureRate: 0,
      lastFailure: null,
      lastSeen: new Date().toISOString(),
      missionsCompleted: 0,
      failures: 0,
      _totalRuns: 0,
      _totalLatency: 0
    }));
  }

  listCapabilities() {
    return [...this.capabilityRegistry];
  }

  get(agentId) {
    return this.agents.find((a) => a.id === agentId) || null;
  }

  selectHealthyForCapability(capability) {
    return this.agents
      .filter((a) => a.capabilities.includes(capability) && a.health >= 40 && a.status !== "QUARANTINED")
      .sort((a, b) => b.health - a.health || a.avgLatency - b.avgLatency)[0] || null;
  }

  recordOutcome(agentId, { ok, latencyMs = 10, error = null }) {
    const agent = this.get(agentId);
    if (!agent) return null;

    agent._totalRuns += 1;
    agent._totalLatency += Math.max(0, Number(latencyMs) || 0);
    agent.avgLatency = Math.round(agent._totalLatency / agent._totalRuns);
    agent.lastSeen = new Date().toISOString();

    if (ok) {
      agent.missionsCompleted += 1;
      agent.status = "IDLE";
    } else {
      agent.failures += 1;
      agent.lastFailure = { at: new Date().toISOString(), error: String(error || "execution_failed") };
      agent.status = agent.failures >= 3 ? "QUARANTINED" : "DEGRADED";
    }

    const successes = agent._totalRuns - agent.failures;
    agent.successRate = Number(((successes / agent._totalRuns) * 100).toFixed(1));
    agent.failureRate = Number(((agent.failures / agent._totalRuns) * 100).toFixed(1));
    agent.health = Math.max(0, Math.min(100, Math.round(agent.successRate - agent.failures * 5)));
    return agent;
  }
}

module.exports = AgentRegistry;
