"use strict";

const crypto = require("crypto");
const { RedForceEngine } = require("./red-force-engine");
const { BlueForceEngine } = require("./blue-force-engine");

class MarauderWarfareSimulator {
  constructor(options = {}) {
    this.version = "1.0.0";
    this.rootController = options.rootController || null;
    this.blackbox = options.blackbox || null;
    this.history = [];
    this.proposedAgents = [];
  }

  runMonteCarloRisk(baseRiskScore, trials = 250) {
    const n = Math.max(50, Math.min(2000, Number(trials || 250)));
    const mean = Number(baseRiskScore || 50);
    let highRiskCount = 0;
    let sum = 0;

    for (let i = 0; i < n; i++) {
      const jitter = Math.sin(i * 12.9898 + mean * 0.78233) * 12;
      const sample = Math.max(0, Math.min(100, mean + jitter));
      sum += sample;
      if (sample >= 70) highRiskCount++;
    }

    return {
      trials: n,
      expectedRiskScore: Number((sum / n).toFixed(2)),
      pHighRisk: Number((highRiskCount / n).toFixed(3))
    };
  }

  runIsolatedAgentTests(agentSpec = {}) {
    const checks = [];

    const hasValidName = typeof agentSpec.name === "string" && agentSpec.name.trim().length >= 3;
    checks.push({
      check: "agent_name_valid",
      passed: hasValidName,
      detail: hasValidName ? `Agent name verified: ${agentSpec.name}` : "Missing or invalid agent name"
    });

    const hasScope = Array.isArray(agentSpec.allowedScopes) && agentSpec.allowedScopes.length > 0;
    checks.push({
      check: "non_empty_allowed_scopes",
      passed: hasScope,
      detail: hasScope ? `Scopes: ${agentSpec.allowedScopes.join(", ")}` : "No allowed scopes defined"
    });

    const noWeaponsAutonomy = agentSpec.automaticWeaponsRelease === false;
    checks.push({
      check: "no_autonomous_weapons_release",
      passed: noWeaponsAutonomy,
      detail: noWeaponsAutonomy ? "Confirmed automaticWeaponsRelease is false" : "Violates safety rule"
    });

    const testSuitePassed = checks.every((c) => c.passed);
    return {
      testSuitePassed,
      checks,
      executedAt: new Date().toISOString()
    };
  }

  _isAuthorizedByRoot(authResult) {
    if (!authResult || typeof authResult !== "object") return false;
    if (typeof authResult.allowed === "boolean") return authResult.allowed;
    if (typeof authResult.authorized === "boolean") return authResult.authorized;
    if (typeof authResult.approved === "boolean") return authResult.approved;
    if (typeof authResult.ok === "boolean") return authResult.ok;
    return false;
  }

  proposeSelfImprovementAgent(weaknessSummary = {}, humanApproved = false) {
    const approvedByHuman = Boolean(humanApproved);
    const agentName = "BLUE-TELEMETRY-CONSISTENCY-GUARD";
    const agentSpec = {
      name: agentName,
      allowedScopes: ["TELEMETRY_CONSISTENCY_CHECK", "FUSION_ANOMALY_REPORT"],
      automaticWeaponsRelease: false
    };

    const testReport = this.runIsolatedAgentTests(agentSpec);
    const hasRootController = Boolean(
      this.rootController && typeof this.rootController.authorizeAndPrepare === "function"
    );

    let rootPermitted = false;
    let rootAuthResponse = null;
    let status = "HELD_PENDING_APPROVAL";

    if (!hasRootController) {
      status = "BLOCKED_NO_ROOT_CONTROLLER";
    } else if (!testReport.testSuitePassed) {
      status = "BLOCKED_FAILED_TESTS";
    } else if (!approvedByHuman) {
      status = "HELD_PENDING_HUMAN_APPROVAL";
    } else {
      rootAuthResponse = this.rootController.authorizeAndPrepare({
        actor: "MARAUDER-AI-CORE",
        action: "REGISTER_DEFENSE_AGENT",
        target: agentName,
        scope: agentSpec.allowedScopes,
        humanApproved: true,
        automaticWeaponsRelease: false
      });
      rootPermitted = this._isAuthorizedByRoot(rootAuthResponse);
      status = rootPermitted ? "APPROVED_FOR_DEFENSE_ROSTER" : "DENIED_BY_ROOT_CONTROLLER";
    }

    const proposal = {
      proposalId: `PROP-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      proposedAgent: agentName,
      agentSpec,
      triggerGaps: Array.isArray(weaknessSummary.gaps) ? weaknessSummary.gaps : [],
      rootControllerPresent: hasRootController,
      automatedTestsPassed: testReport.testSuitePassed,
      testReport,
      rootControllerPermitted: rootPermitted,
      rootAuthResponse,
      humanApproved: approvedByHuman,
      status,
      automaticWeaponsRelease: false,
      ts: new Date().toISOString()
    };

    this.proposedAgents.push(proposal);

    if (this.blackbox && typeof this.blackbox.append === "function") {
      this.blackbox.append("WARFARE_AGENT_PROPOSAL", proposal);
    }

    return proposal;
  }

  runScenario(options = {}) {
    const red = new RedForceEngine(options.seed || 2026);
    const blue = new BlueForceEngine();
    const scenario = red.buildBlackSeaShieldScenario(options);

    const stepLogs = [];
    for (const step of scenario.timeline) {
      const blueEvents = blue.processScenarioStep(step);
      stepLogs.push({
        t: step.t,
        redAgent: step.agent,
        blueEvents
      });
    }

    const blueAssessment = blue.assessRisk(scenario.assetsProtected);
    const weaknessAnalysis = red.analyzeWeaknesses(blueAssessment);
    const monteCarlo = this.runMonteCarloRisk(blueAssessment.riskScore, options.trials || 200);
    const improvementProposal = this.proposeSelfImprovementAgent(
      weaknessAnalysis,
      options.humanApproved === true
    );

    const runId = `WAR-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const record = {
      runId,
      simulatorVersion: this.version,
      simulationOnly: true,
      automaticWeaponsRelease: false,
      scenarioName: scenario.scenarioName,
      redAgentsCount: red.agents.length,
      blueAgentsCount: blue.agents.length,
      stepsExecuted: stepLogs.length,
      blueAssessment,
      weaknessAnalysis,
      monteCarlo,
      improvementProposal,
      stepLogs,
      completedAt: new Date().toISOString()
    };

    this.history.push(record);
    if (this.history.length > 50) this.history.shift();

    if (this.blackbox && typeof this.blackbox.append === "function") {
      this.blackbox.append("WARFARE_SIMULATION_RUN", {
        runId,
        scenarioName: record.scenarioName,
        riskScore: blueAssessment.riskScore,
        proposalId: improvementProposal.proposalId,
        proposalStatus: improvementProposal.status
      });
    }

    return record;
  }
}


function appendToBlackBoxLedger(blackBox, entry) {
  if (!blackBox) return { recorded: false, reason: "NO_BLACKBOX" };
  if (typeof blackBox.record === "function") {
    blackBox.record(entry);
    return { recorded: true, method: "record" };
  }
  if (typeof blackBox.append === "function") {
    blackBox.append(entry);
    return { recorded: true, method: "append" };
  }
  if (typeof blackBox.log === "function") {
    blackBox.log(entry);
    return { recorded: true, method: "log" };
  }
  if (Array.isArray(blackBox.entries)) {
    blackBox.entries.push(entry);
    return { recorded: true, method: "entries" };
  }
  if (Array.isArray(blackBox)) {
    blackBox.push(entry);
    return { recorded: true, method: "array" };
  }
  return { recorded: false, reason: "UNSUPPORTED_BLACKBOX_INTERFACE" };
}

async function evaluateWarfareScenarioWithGateway(input = {}) {
  const humanApproved = input.humanApproved === true;
  const automaticWeaponsRelease = false;

  if (!input.core || typeof input.core.reasonWithGateway !== "function") {
    throw new Error("VALID_CORE_WITH_REASON_WITH_GATEWAY_REQUIRED");
  }

  let scenarioResult = input.scenarioResult;
  if (!scenarioResult && typeof input.simulator?.runScenario === "function") {
    scenarioResult = input.simulator.runScenario({
      ...(input.scenarioOptions || {}),
      humanApproved,
      automaticWeaponsRelease
    });
  }
  if (!scenarioResult) {
    throw new Error("SCENARIO_RESULT_OR_SIMULATOR_REQUIRED");
  }

  const summaryPayload = {
    scenarioName: scenarioResult.name || scenarioResult.scenarioName || "WARFARE-SCENARIO",
    riskScore: scenarioResult.blueAssessment?.riskScore ?? scenarioResult.riskScore ?? null,
    redOutcome: scenarioResult.redOutcome || scenarioResult.outcome || null,
    blueStatus: scenarioResult.blueAssessment?.status || null,
    humanApproved,
    automaticWeaponsRelease
  };

  const prompt =
    input.prompt ||
    [
      "Analyze this defensive simulation summary and propose bounded defensive improvements.",
      "Do NOT authorize autonomous weapons release.",
      JSON.stringify(summaryPayload)
    ].join("\n");

  const reasonResult = await input.core.reasonWithGateway({
    task: input.task || "warfare-analysis",
    model: input.model,
    provider: input.provider,
    timeoutMs: input.timeoutMs,
    temperature: input.temperature,
    prompt
  });

  const usedModel = Boolean(reasonResult && reasonResult.usedModel === true);
  const executionMode = usedModel ? "LIVE_MODEL" : "FALLBACK_NO_MODEL";

  let rootDecision = {
    allowed: false,
    status: humanApproved ? "PENDING_ROOT_CONTROLLER" : "HELD_PENDING_HUMAN_APPROVAL",
    reason: humanApproved ? "AWAITING_ROOT_AUTHORIZATION" : "HUMAN_APPROVAL_REQUIRED_DEFAULT_FALSE"
  };

  if (input.rootController && typeof input.rootController.authorizeAndPrepare === "function") {
    const auth = await input.rootController.authorizeAndPrepare({
      action: "WARFARE_DEFENSE_PROPOSAL",
      humanApproved,
      automaticWeaponsRelease,
      usedModel,
      executionMode,
      scenario: summaryPayload
    });
    rootDecision = {
      allowed: Boolean(auth && auth.allowed === true && humanApproved === true && automaticWeaponsRelease === false),
      status: auth && auth.allowed === true && humanApproved === true ? "APPROVED_FOR_DEFENSE_ROSTER" : "HELD_PENDING_HUMAN_APPROVAL",
      reason: (auth && auth.reason) || (humanApproved ? "AUTHORIZED_BY_ROOT" : "REQUIRES_HUMAN_APPROVAL")
    };
  }

  const blackBoxEntry = {
    timestamp: new Date().toISOString(),
    eventType: "WARFARE_SCENARIO_EVALUATION",
    scenario: summaryPayload,
    governance: {
      humanApproved,
      automaticWeaponsRelease,
      rootDecision
    },
    modelTelemetry: {
      usedModel,
      executionMode,
      provider: reasonResult.provider || "fallback",
      model: reasonResult.model || null,
      latencyMs: reasonResult.latencyMs || 0,
      fallbackReason: usedModel ? null : (reasonResult.fallbackReason || "NO_LIVE_MODEL")
    },
    analysisOutput: reasonResult.output || ""
  };

  const blackBoxWrite = appendToBlackBoxLedger(input.blackBox, blackBoxEntry);

  return {
    ok: Boolean(reasonResult.ok !== false),
    scenario: summaryPayload,
    governance: blackBoxEntry.governance,
    modelTelemetry: blackBoxEntry.modelTelemetry,
    analysisOutput: blackBoxEntry.analysisOutput,
    blackBoxWrite,
    blackBoxEntry
  };
}

module.exports = {
  evaluateWarfareScenarioWithGateway, MarauderWarfareSimulator };
