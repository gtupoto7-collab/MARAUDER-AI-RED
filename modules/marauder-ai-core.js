"use strict";

const crypto = require("crypto");

class MarauderModelAdapter {
  constructor(name = "MarauderModelAdapter") {
    this.name = name;
  }

  async generate(_request) {
    throw new Error("MODEL_ADAPTER_NOT_IMPLEMENTED");
  }
}

class LocalModelAdapter extends MarauderModelAdapter {
  constructor(opts = {}) {
    super("LocalModelAdapter");
    this.endpoint = opts.endpoint || "http://127.0.0.1:11434";
    this.model = opts.model || "llama3.2";
  }

  async generate(request) {
    return {
      adapter: this.name,
      model: this.model,
      endpoint: this.endpoint,
      prompt: String(request && request.prompt ? request.prompt : ""),
      output: "[LOCAL_ADAPTER_READY] Attach live inference transport for token generation."
    };
  }
}

class RemoteModelAdapter extends MarauderModelAdapter {
  constructor(opts = {}) {
    super("RemoteModelAdapter");
    this.provider = opts.provider || "remote-endpoint";
    this.model = opts.model || "configured-remote";
  }

  async generate(request) {
    return {
      adapter: this.name,
      provider: this.provider,
      model: this.model,
      prompt: String(request && request.prompt ? request.prompt : ""),
      output: "[REMOTE_ADAPTER_READY] Configure remote inference client."
    };
  }
}

class MarauderNativeAdapter extends MarauderModelAdapter {
  constructor(opts = {}) {
    super("MarauderNativeAdapter");
    this.checkpoint = opts.checkpoint || "marauder-native-v0";
  }

  async generate(request) {
    return {
      adapter: this.name,
      checkpoint: this.checkpoint,
      prompt: String(request && request.prompt ? request.prompt : ""),
      output: "[NATIVE_ADAPTER_READY] Native MARAUDER weights slot."
    };
  }
}

class KnowledgeFabric {
  constructor() {
    this.records = new Map();
  }

  _computeSourceHash(source, evidence) {
    return crypto
      .createHash("sha256")
      .update(`${String(source || "")}::${JSON.stringify(evidence ?? null)}`)
      .digest("hex");
  }

  upsertFact({
    id,
    domain = "general",
    source = "unspecified",
    evidence = null,
    claim = "",
    verified = false,
    verifiedBy = null,
    confidence = 0.5,
    provenance = []
  }) {
    const key = id || crypto.createHash("sha256").update(`${domain}:${claim}`).digest("hex").slice(0, 12);
    const prev = this.records.get(key);
    const nextVersion = prev ? prev.version + 1 : 1;
    const sourceHash = this._computeSourceHash(source, evidence);
    const isVerified = Boolean(verified && verifiedBy && evidence);

    const record = {
      id: key,
      version: nextVersion,
      domain: String(domain),
      claim: String(claim),
      source: String(source),
      sourceHash,
      evidence,
      verified: isVerified,
      verifiedBy: isVerified ? String(verifiedBy) : null,
      verificationTime: isVerified ? new Date().toISOString() : null,
      confidence: Math.max(0, Math.min(1, Number(confidence))),
      provenance: Array.isArray(provenance)
        ? provenance.concat({
            version: nextVersion,
            source,
            sourceHash,
            verified: isVerified,
            recordedAt: new Date().toISOString()
          })
        : [
            {
              version: nextVersion,
              source,
              sourceHash,
              verified: isVerified,
              recordedAt: new Date().toISOString()
            }
          ]
    };

    this.records.set(key, record);
    return record;
  }

  inspectClaim(topic) {
    const q = String(topic || "").toLowerCase().trim();
    if (!q) {
      return { epistemicState: "UNKNOWABLE_NO_EVIDENCE", matches: [] };
    }

    const matches = Array.from(this.records.values()).filter(
      (r) =>
        r.claim.toLowerCase().includes(q) ||
        r.domain.toLowerCase().includes(q) ||
        r.source.toLowerCase().includes(q)
    );

    if (!matches.length) {
      return {
        epistemicState: "UNKNOWABLE_NO_EVIDENCE",
        statement: "Не знам — липсва източник и доказателство в Knowledge Fabric.",
        matches: []
      };
    }

    const verifiedMatches = matches.filter((m) => m.verified);
    if (verifiedMatches.length > 0) {
      return {
        epistemicState: "VERIFIED_FACT",
        statement: "Това е проверено от системата с налично доказателство.",
        matches: verifiedMatches
      };
    }

    return {
      epistemicState: "SOURCED_UNVERIFIED",
      statement: "Имам източник за това, но твърдението все още не е верифицирано от системата.",
      matches
    };
  }
}

class MarauderAICore {
  constructor(opts = {}) {
    if (!opts.modelAdapter || !(opts.modelAdapter instanceof MarauderModelAdapter)) {
      throw new Error("VALID_MARAUDER_MODEL_ADAPTER_REQUIRED");
    }

    this.identity = Object.freeze({
      name: "MARAUDER-AI",
      role: "INTELLIGENCE_LAYER",
      canMutatePolicy: false,
      canSelfGrantCapabilities: false,
      canBypassApproval: false
    });

    this.modelAdapter = opts.modelAdapter;
    this.knowledge = new KnowledgeFabric();
    this.proposals = [];
  }

  async think(prompt, context = {}) {
    return this.modelAdapter.generate({ prompt, context });
  }

  planAndPropose({ intent, capability, scope, requiresApproval = true, evidenceRefs = [], steps = [] }) {
    const hasEvidence = Array.isArray(evidenceRefs) && evidenceRefs.length > 0;
    const plan = {
      proposalId: `PLAN-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      author: this.identity.name,
      intent: String(intent || ""),
      capability: String(capability || ""),
      scope: String(scope || ""),
      steps: Array.isArray(steps) ? steps : [],
      requiresApproval: Boolean(requiresApproval),
      evidenceGrounded: hasEvidence,
      evidenceRefs,
      status: hasEvidence ? "PENDING_ROOT_AUTHORITY" : "BLOCKED_MISSING_EVIDENCE",
      createdAt: new Date().toISOString()
    };
    this.proposals.push(plan);
    return plan;
  }

  submitToRootController(proposalId, rootController) {
    const plan = this.proposals.find((p) => p.proposalId === proposalId);
    if (!plan) {
      return { allowed: false, reason: "PROPOSAL_NOT_FOUND" };
    }
    if (!plan.evidenceGrounded) {
      plan.status = "DENIED_NO_EVIDENCE";
      return { allowed: false, reason: "EVIDENCE_GROUNDING_REQUIRED", plan };
    }
    if (!rootController || typeof rootController.evaluateRequest !== "function") {
      plan.status = "DENIED_NO_ROOT_CONTROLLER";
      return { allowed: false, reason: "ROOT_CONTROLLER_BOUNDARY_REQUIRED", plan };
    }
    const decision = rootController.evaluateRequest(plan);
    plan.status = decision && decision.allowed ? "APPROVED_BY_ROOT" : "DENIED_BY_ROOT";
    return decision;
  }

  getStatus() {
    return {
      identity: this.identity,
      adapter: this.modelAdapter.name,
      knowledgeEntries: this.knowledge.records.size,
      proposalsCount: this.proposals.length
    };
  }
}

module.exports = {
  MarauderModelAdapter,
  LocalModelAdapter,
  RemoteModelAdapter,
  MarauderNativeAdapter,
  KnowledgeFabric,
  MarauderAICore
};

class MarauderPlanner {
  constructor(knowledgeFabric) {
    this.knowledge = knowledgeFabric;
  }

  buildPlan({ goal, capability = "evidence.verify", scope = "repo.readonly", evidenceRefs = [], steps = [] }) {
    const grounded = Array.isArray(evidenceRefs) && evidenceRefs.length > 0;
    return {
      planId: `PLN-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      goal: String(goal || "").trim(),
      capability,
      scope,
      evidenceRefs,
      grounded,
      steps: steps.length ? steps : ["collect-evidence", "validate-policy", "verify-outcome"],
      createdAt: new Date().toISOString()
    };
  }
}

class AgentOrchestrator {
  constructor(aiCore, rootController) {
    this.aiCore = aiCore;
    this.rootController = rootController;
    this.planner = new MarauderPlanner(aiCore.knowledge);
    this.executions = [];
  }

  async orchestrate({ goal, capability, scope, evidenceRefs = [], steps = [], authContext = {} }) {
    const plan = this.planner.buildPlan({ goal, capability, scope, evidenceRefs, steps });
    if (!plan.grounded) {
      const record = {
        executionId: `EXEC-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
        plan,
        allowed: false,
        reason: "MISSING_EVIDENCE_GROUNDING",
        timestamp: new Date().toISOString()
      };
      this.executions.push(record);
      return record;
    }

    if (!this.rootController) {
      const record = {
        executionId: `EXEC-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
        plan,
        allowed: false,
        reason: "ROOT_CONTROLLER_REQUIRED",
        timestamp: new Date().toISOString()
      };
      this.executions.push(record);
      return record;
    }

    let decision;
    if (typeof this.rootController.authorize === "function") {
      decision = this.rootController.authorize({
        agentId: authContext.agentId || "MARAUDER-AI-ORCHESTRATOR",
        capability: plan.capability,
        scope: plan.scope,
        nonce: authContext.nonce,
        signature: authContext.signature,
        approvalToken: authContext.approvalToken,
        planId: plan.planId
      });
    } else if (typeof this.rootController.evaluateRequest === "function") {
      decision = this.rootController.evaluateRequest(plan);
    } else {
      decision = { allowed: false, reason: "UNSUPPORTED_ROOT_CONTROLLER_INTERFACE" };
    }

    const allowed = Boolean(decision && (decision.allowed === true || decision.ok === true));
    const record = {
      executionId: `EXEC-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      plan,
      allowed,
      decision,
      timestamp: new Date().toISOString()
    };
    this.executions.push(record);
    return record;
  }
}

module.exports.MarauderPlanner = MarauderPlanner;
module.exports.AgentOrchestrator = AgentOrchestrator;
