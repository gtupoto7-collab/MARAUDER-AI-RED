const DEFAULT_ALLOWED_CAPABILITIES = new Set([
  "filesystem.read",
  "process.inspect",
  "network.observe",
  "logs.read",
  "security.scan",
  "sandbox.execute"
]);

const DEFAULT_SCOPE_ALLOWLIST = new Set([
  "localhost",
  "127.0.0.1",
  "verified-local-lab",
  "admiralerror-local-lab"
]);

class CapabilityEngine {
  constructor({ allowedCapabilities = DEFAULT_ALLOWED_CAPABILITIES, allowedTargets = DEFAULT_SCOPE_ALLOWLIST } = {}) {
    this.allowedCapabilities = allowedCapabilities;
    this.allowedTargets = allowedTargets;
  }

  grant({ agent, capability, targetScope }) {
    const cleanCap = String(capability || "").trim();
    const cleanScope = String(targetScope || "").trim();

    if (!agent || agent.health !== "healthy") {
      return { granted: false, reason: "AGENT_UNHEALTHY_OR_MISSING", capability: cleanCap };
    }
    if (!this.allowedTargets.has(cleanScope)) {
      return { granted: false, reason: "TARGET_OUT_OF_SCOPE", capability: cleanCap, targetScope: cleanScope };
    }
    if (!this.allowedCapabilities.has(cleanCap)) {
      return { granted: false, reason: "CAPABILITY_NOT_IN_ALLOWLIST", capability: cleanCap };
    }
    if (!Array.isArray(agent.capabilities) || !agent.capabilities.includes(cleanCap)) {
      return { granted: false, reason: "AGENT_LACKS_DECLARED_CAPABILITY", capability: cleanCap };
    }

    return {
      granted: true,
      agentId: agent.id,
      capability: cleanCap,
      targetScope: cleanScope,
      mode: "least-privilege",
      issuedAt: new Date().toISOString()
    };
  }
}

module.exports = CapabilityEngine;
