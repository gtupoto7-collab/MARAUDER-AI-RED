"use strict";

const crypto = require("crypto");

const ALLOWED_CAPABILITIES = new Set([
  "code.audit.read",
  "dependency.audit.read",
  "evidence.verify",
  "runtime.telemetry.read",
  "test.generate.sandbox",
  "incident.correlate",
  "policy.check.read",
  "model.eval.read",
  "agent.qa.sandbox",
  "telemetry.sensor.read",
  "countermeasure.plan.draft"
]);

const FORBIDDEN_CAPABILITIES = new Set([
  "root.override",
  "killswitch.disable",
  "ledger.mutate",
  "policy.bypass",
  "unapproved.actuator.fire"
]);

const LIFECYCLE_STAGES = [
  "DISCOVER",
  "PROPOSE",
  "GENERATE",
  "TEST",
  "VERIFY",
  "APPROVE",
  "REGISTER",
  "DEPLOY",
  "MONITOR",
  "EVALUATE",
  "RETIRE_OR_UPGRADE"
];

class AgentEvolutionController {
  constructor(opts = {}) {
    this.registry = new Map();
    this.candidates = new Map();
    this.auditChain = [];
    this.allowedScopes = new Set(opts.allowedScopes || ["repo.readonly", "telemetry.readonly", "sandbox.test"]);
  }

  _hash(payload) {
    const prev = this.auditChain.length ? this.auditChain[this.auditChain.length - 1].hash : "GENESIS";
    const hash = crypto.createHash("sha256").update(`${prev}|${JSON.stringify(payload)}`).digest("hex");
    this.auditChain.push({ prev, hash, ts: new Date().toISOString(), payload });
    return hash;
  }

  proposeAgent(proposal = {}) {
    const id = `CAND-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const record = {
      id,
      name: String(proposal.name || "").trim(),
      role: String(proposal.role || "SpecialistAgent").trim(),
      reason: String(proposal.reason || "").trim(),
      capabilities: Array.isArray(proposal.capabilities) ? proposal.capabilities : [],
      scopes: Array.isArray(proposal.scopes) ? proposal.scopes : [],
      hasTests: Boolean(proposal.hasTests),
      hasRollback: Boolean(proposal.hasRollback),
      hasAuditHooks: Boolean(proposal.hasAuditHooks),
      stage: "PROPOSE",
      status: "PROPOSED",
      rejectionReason: null,
      approvedBy: null,
      registryHash: null,
      createdAt: new Date().toISOString()
    };
    this.candidates.set(id, record);
    this._hash({ event: "AGENT_PROPOSED", id, name: record.name });
    return record;
  }

  verifyCandidate(candidateId, testPassed = true) {
    const c = this.candidates.get(candidateId);
    if (!c) return { ok: false, reason: "CANDIDATE_NOT_FOUND" };

    c.stage = "VERIFY";
    const violations = [];

    if (!c.name || c.name.length < 3) violations.push("INVALID_AGENT_NAME");
    if (!c.capabilities.length) violations.push("EMPTY_CAPABILITIES_DEFAULT_DENY");

    for (const cap of c.capabilities) {
      if (FORBIDDEN_CAPABILITIES.has(cap)) violations.push(`FORBIDDEN_CAPABILITY:${cap}`);
      else if (!ALLOWED_CAPABILITIES.has(cap)) violations.push(`CAPABILITY_EXCEEDS_POLICY:${cap}`);
    }

    for (const sc of c.scopes) {
      if (!this.allowedScopes.has(sc)) violations.push(`SCOPE_NOT_ALLOWED:${sc}`);
    }

    if (!testPassed || !c.hasTests) violations.push("TESTS_REQUIRED_AND_PASSED");
    if (!c.hasRollback) violations.push("ROLLBACK_PLAN_REQUIRED");
    if (!c.hasAuditHooks) violations.push("AUDIT_HOOKS_REQUIRED");

    if (violations.length > 0) {
      c.status = "REJECTED";
      c.rejectionReason = violations.join(", ");
      this._hash({ event: "AGENT_REJECTED", id: c.id, violations });
      return { ok: false, status: c.status, violations, candidate: c };
    }

    c.status = "VERIFIED";
    c.stage = "APPROVE";
    this._hash({ event: "AGENT_VERIFIED", id: c.id, name: c.name });
    return { ok: true, status: c.status, candidate: c };
  }

  approveAndRegister(candidateId, approver = "ADMIRALERROR-ROOT") {
    const c = this.candidates.get(candidateId);
    if (!c) return { ok: false, reason: "CANDIDATE_NOT_FOUND" };
    if (c.status !== "VERIFIED") {
      return { ok: false, reason: "CANDIDATE_NOT_VERIFIED", currentStatus: c.status };
    }

    c.status = "ACTIVE";
    c.stage = "DEPLOY";
    c.approvedBy = approver;
    c.approvedAt = new Date().toISOString();
    c.registryHash = crypto
      .createHash("sha256")
      .update(`${c.id}|${c.name}|${c.capabilities.join(",")}|${c.approvedAt}`)
      .digest("hex");

    this.registry.set(c.name, {
      name: c.name,
      role: c.role,
      capabilities: c.capabilities,
      scopes: c.scopes,
      approvedBy: approver,
      registryHash: c.registryHash,
      activatedAt: c.approvedAt,
      status: "ACTIVE"
    });

    this._hash({ event: "AGENT_REGISTERED_ACTIVE", id: c.id, name: c.name, hash: c.registryHash });
    return { ok: true, agent: this.registry.get(c.name) };
  }

  getSummary() {
    return {
      lifecycleStages: LIFECYCLE_STAGES,
      activeAgentsCount: this.registry.size,
      candidatesCount: this.candidates.size,
      auditEntries: this.auditChain.length,
      chainTail: this.auditChain.length ? this.auditChain[this.auditChain.length - 1].hash : "GENESIS"
    };
  }
}

module.exports = {
  AgentEvolutionController,
  LIFECYCLE_STAGES,
  ALLOWED_CAPABILITIES,
  FORBIDDEN_CAPABILITIES
};
