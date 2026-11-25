"use strict";

const DEFAULT_AGENT_PROFILES = {
  "soc-triage": {
    domain: "SOC",
    capabilities: ["triage", "alert", "anomaly", "threat", "incident"],
    defaultTaskType: "warfare-triage",
    requiresApproval: false
  },
  "log-forensics": {
    domain: "SOC",
    capabilities: ["log", "logs", "telemetry", "timeline", "forensics"],
    defaultTaskType: "log-analysis",
    requiresApproval: false
  },
  "threat-intel": {
    domain: "INTEL",
    capabilities: ["ioc", "intel", "campaign", "reputation", "context"],
    defaultTaskType: "warfare-analysis",
    requiresApproval: false
  },
  "asset-guard": {
    domain: "SECOPS",
    capabilities: ["asset", "inventory", "host", "sensor", "config"],
    defaultTaskType: "asset-inventory",
    requiresApproval: false
  },
  "policy-compliance": {
    domain: "SECOPS",
    capabilities: ["compliance", "policy", "audit", "governance", "approval"],
    defaultTaskType: "compliance",
    requiresApproval: false
  },
  "secops-remediation": {
    domain: "SECOPS",
    capabilities: ["remediate", "contain", "isolate", "patch", "change"],
    defaultTaskType: "incident-response",
    requiresApproval: true
  }
};

class AgentEvaluationEngine {
  constructor(options = {}) {
    this.minConfidence = Number(options.minConfidence ?? 0.55);
    this.maxFailureRate = Number(options.maxFailureRate ?? 0.4);
    this.minSamplesForDemotion = Number(options.minSamplesForDemotion ?? 3);
    this.metrics = new Map();
  }

  ensureEntry(agentName) {
    const key = String(agentName || "unknown");
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        agent: key,
        invocations: 0,
        successes: 0,
        failures: 0,
        contradictions: 0,
        totalLatencyMs: 0,
        lastLatencyMs: 0,
        lastModel: null,
        lastExecutionMode: "FALLBACK_NO_MODEL",
        lastConfidence: 0,
        demoted: false,
        demotionReason: null,
        updatedAt: new Date().toISOString()
      });
    }
    return this.metrics.get(key);
  }

  recordOutcome({
    agent,
    ok = true,
    latencyMs = 0,
    model = null,
    executionMode = "FALLBACK_NO_MODEL",
    confidence = 0.5,
    contradicted = false
  }) {
    const entry = this.ensureEntry(agent);
    entry.invocations += 1;
    if (ok) {
      entry.successes += 1;
    } else {
      entry.failures += 1;
    }
    if (contradicted) {
      entry.contradictions += 1;
    }
    const cleanLatency = Math.max(0, Number(latencyMs || 0));
    entry.totalLatencyMs += cleanLatency;
    entry.lastLatencyMs = cleanLatency;
    entry.lastModel = model || null;
    entry.lastExecutionMode = executionMode || "FALLBACK_NO_MODEL";
    entry.lastConfidence = Number(confidence ?? 0);
    entry.updatedAt = new Date().toISOString();

    const failureRate = entry.invocations > 0 ? entry.failures / entry.invocations : 0;
    if (
      entry.invocations >= this.minSamplesForDemotion &&
      (failureRate > this.maxFailureRate || entry.lastConfidence < this.minConfidence)
    ) {
      entry.demoted = true;
      entry.demotionReason =
        failureRate > this.maxFailureRate
          ? `HIGH_FAILURE_RATE_${failureRate.toFixed(2)}`
          : `LOW_CONFIDENCE_${entry.lastConfidence.toFixed(2)}`;
    } else if (failureRate <= this.maxFailureRate && entry.lastConfidence >= this.minConfidence) {
      entry.demoted = false;
      entry.demotionReason = null;
    }

    return this.getReport(agent);
  }

  getReport(agentName) {
    const entry = this.ensureEntry(agentName);
    const failureRate = entry.invocations > 0 ? entry.failures / entry.invocations : 0;
    const avgLatencyMs =
      entry.invocations > 0 ? Math.round(entry.totalLatencyMs / entry.invocations) : 0;
    return {
      ...entry,
      failureRate: Number(failureRate.toFixed(3)),
      avgLatencyMs
    };
  }

  listReports() {
    return Array.from(this.metrics.keys()).map((name) => this.getReport(name));
  }
}

class AgentRouter {
  constructor(options = {}) {
    this.profiles = new Map(Object.entries(DEFAULT_AGENT_PROFILES));
    if (options.profiles && typeof options.profiles === "object") {
      for (const [k, v] of Object.entries(options.profiles)) {
        this.registerProfile(k, v);
      }
    }
    this.evaluator = options.evaluator || new AgentEvaluationEngine(options.evaluatorOptions);
    this.memoryFabric = options.memoryFabric || null;
  }

  registerProfile(name, profile = {}) {
    if (!name || typeof name !== "string") {
      throw new Error("AGENT_PROFILE_NAME_REQUIRED");
    }
    const existing = this.profiles.get(name) || {
      domain: "SECOPS",
      capabilities: [],
      defaultTaskType: "general",
      requiresApproval: false
    };
    const merged = {
      ...existing,
      ...profile,
      capabilities: Array.isArray(profile.capabilities)
        ? [...profile.capabilities]
        : [...existing.capabilities]
    };
    this.profiles.set(name, merged);
    return merged;
  }

  routeEvent(event = {}) {
    const text = [
      event.type || "",
      event.title || "",
      event.summary || "",
      event.goal || "",
      Array.isArray(event.tags) ? event.tags.join(" ") : ""
    ]
      .join(" ")
      .toLowerCase();

    const matched = [];
    for (const [name, profile] of this.profiles.entries()) {
      const score = profile.capabilities.reduce((acc, cap) => {
        return text.includes(String(cap).toLowerCase()) ? acc + 1 : acc;
      }, 0);
      if (score > 0) {
        matched.push({ agent: name, profile, score });
      }
    }

    matched.sort((a, b) => {
      const repA = this.evaluator.getReport(a.agent);
      const repB = this.evaluator.getReport(b.agent);
      const demotePenaltyA = repA.demoted ? -10 : 0;
      const demotePenaltyB = repB.demoted ? -10 : 0;
      return (b.score + demotePenaltyB) - (a.score + demotePenaltyA);
    });

    const activeSelection = matched.filter((m) => !this.evaluator.getReport(m.agent).demoted);
    const chosen = (activeSelection.length > 0 ? activeSelection : matched).slice(0, 3);

    if (chosen.length === 0) {
      chosen.push({
        agent: "soc-triage",
        profile: this.profiles.get("soc-triage"),
        score: 1
      });
    }

    const decision = {
      eventType: event.type || "SECURITY_EVENT",
      selectedAgents: chosen.map((c) => ({
        agent: c.agent,
        domain: c.profile.domain,
        taskType: c.profile.defaultTaskType,
        requiresApproval: Boolean(c.profile.requiresApproval),
        score: c.score,
        evaluator: this.evaluator.getReport(c.agent)
      })),
      humanApprovedRequired: chosen.some((c) => c.profile.requiresApproval),
      automaticWeaponsRelease: false
    };

    if (this.memoryFabric && typeof this.memoryFabric.recordAudit === "function") {
      this.memoryFabric.recordAudit(
        "AGENT_ROUTED",
        {
          eventType: decision.eventType,
          agents: decision.selectedAgents.map((s) => s.agent),
          humanApprovedRequired: decision.humanApprovedRequired
        },
        "agent-router"
      );
    }

    return decision;
  }

  evaluateFindings({ agent, findings = [], contradictions = [], latencyMs = 0, model = null, executionMode = "FALLBACK_NO_MODEL", ok = true }) {
    const evidenceCount = Array.isArray(findings) ? findings.length : 0;
    const contradictionCount = Array.isArray(contradictions) ? contradictions.length : 0;

    const rawConfidence =
      0.35 +
      Math.min(0.45, evidenceCount * 0.15) +
      (executionMode === "LIVE_MODEL" ? 0.1 : 0) -
      Math.min(0.4, contradictionCount * 0.2) -
      (ok ? 0 : 0.35);

    const confidence = Number(Math.max(0.05, Math.min(0.99, rawConfidence)).toFixed(2));
    const report = this.evaluator.recordOutcome({
      agent,
      ok,
      latencyMs,
      model,
      executionMode,
      confidence,
      contradicted: contradictionCount > 0
    });

    if (this.memoryFabric && typeof this.memoryFabric.recordAudit === "function") {
      this.memoryFabric.recordAudit(
        "AGENT_EVALUATED",
        {
          agent,
          confidence,
          contradictionCount,
          demoted: report.demoted,
          executionMode
        },
        "evaluation-engine"
      );
    }

    return {
      confidence,
      contradictionCount,
      evidenceCount,
      report
    };
  }
}

module.exports = {
  DEFAULT_AGENT_PROFILES,
  AgentEvaluationEngine,
  AgentRouter
};
