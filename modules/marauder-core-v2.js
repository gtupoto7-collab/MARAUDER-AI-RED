const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const AgentRegistry = require("./agent-registry");

const MISSION_STATES = new Set([
  "CREATED",
  "AUTHORIZED",
  "QUEUED",
  "RUNNING",
  "VERIFYING",
  "COMPLETED",
  "FAILED",
  "HALTED",
  "CANCELLED"
]);

const FINDING_LIFECYCLE = [
  "OBSERVED",
  "CORRELATED",
  "VALIDATING",
  "VERIFIED",
  "REPORTED",
  "REMEDIATING",
  "RESOLVED",
  "REVERIFIED"
];

function sha256(val) {
  return crypto.createHash("sha256").update(JSON.stringify(val)).digest("hex");
}

function generateMissionId() {
  const hex = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `MAR-2026-${hex}`;
}

function generateCorrelationId() {
  return `CORR-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
}

function buildUniversalEvidence({ missionId, assetId, source, observation, severity = "LOW", confidence = 0.9, verified = false }) {
  const base = {
    id: `EVD-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
    missionId,
    assetId,
    source,
    timestamp: new Date().toISOString(),
    observation,
    severity,
    confidence,
    verified: Boolean(verified)
  };
  return { ...base, hash: sha256(base) };
}

class MarauderPipelineV2 {
  constructor(projectDir = process.cwd()) {
    this.projectDir = projectDir;
    this.registry = new AgentRegistry();
    this.outDir = path.join(projectDir, "data", "smoke");
    fs.mkdirSync(this.outDir, { recursive: true });
  }

  async runSafeMission({ objective = "Read-only baseline check", targetScope = "verified-local-lab" } = {}) {
    const missionId = generateMissionId();
    const correlationId = generateCorrelationId();
    const startedAtMs = Date.now();
    const blackBox = [];
    const transitions = [];

    const transition = (nextState) => {
      if (!MISSION_STATES.has(nextState)) {
        throw new Error(`INVALID_MISSION_STATE:${nextState}`);
      }
      transitions.push({ state: nextState, correlationId, missionId, ts: new Date().toISOString() });
      return nextState;
    };

    const appendBox = (stage, payload) => {
      const prevHash = blackBox.length > 0 ? blackBox[blackBox.length - 1].hash : "GENESIS";
      const rec = { missionId, correlationId, stage, ts: new Date().toISOString(), payload, prevHash };
      rec.hash = sha256(rec);
      blackBox.push(rec);
      return rec;
    };

    let state = transition("CREATED");
    appendBox("Mission", { state, objective, targetScope });

    const allowedScopes = new Set(["localhost", "127.0.0.1", "verified-local-lab", "admiralerror-local-lab"]);
    if (!allowedScopes.has(targetScope)) {
      state = transition("HALTED");
      appendBox("Parliament", { state, reason: "SCOPE_DENIED" });
      throw new Error(`SCOPE_DENIED:${targetScope}`);
    }

    state = transition("AUTHORIZED");
    state = transition("QUEUED");
    state = transition("RUNNING");

    const agent = this.registry.selectHealthyForCapability("filesystem.read");
    if (!agent) {
      state = transition("FAILED");
      throw new Error("NO_HEALTHY_AGENT_AVAILABLE");
    }
    agent.status = "RUNNING";
    appendBox("Agent", { state, agentId: agent.id, capability: "filesystem.read" });

    // Safe Executor (read-only check on package.json)
    const execStart = Date.now();
    const pkgExists = fs.existsSync(path.join(this.projectDir, "package.json"));
    const latencyMs = Date.now() - execStart;
    this.registry.recordOutcome(agent.id, { ok: pkgExists, latencyMs });
    appendBox("Safe Executor", { ok: pkgExists, latencyMs, mode: "read-only" });

    const evidence = buildUniversalEvidence({
      missionId,
      assetId: "asset:local-project",
      source: "safe-local-executor:read-only",
      observation: pkgExists ? "package.json present and readable" : "package.json missing",
      severity: pkgExists ? "LOW" : "MEDIUM",
      confidence: pkgExists ? 0.99 : 0.8,
      verified: pkgExists
    });
    if (!evidence.verified) {
      state = transition("FAILED");
      throw new Error("EVIDENCE_VERIFICATION_FAILED");
    }
    appendBox("Evidence", evidence);

    // Parliament check
    const parliamentApproved = evidence.verified && agent.health >= 40;
    appendBox("Parliament", { approved: parliamentApproved, agentHealth: agent.health });
    if (!parliamentApproved) {
      state = transition("HALTED");
      throw new Error("PARLIAMENT_DENIED");
    }

    // Verification & Finding Lifecycle
    state = transition("VERIFYING");
    const finding = {
      id: `FND-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      missionId,
      correlationId,
      evidenceId: evidence.id,
      lifecycle: FINDING_LIFECYCLE.slice(0, 5), // OBSERVED -> CORRELATED -> VALIDATING -> VERIFIED -> REPORTED
      verified: true
    };
    appendBox("Verification", { verified: true, finding });

    state = transition("COMPLETED");
    const durationMs = Date.now() - startedAtMs;

    const metrics = {
      duration: durationMs,
      agentsUsed: [agent.id],
      eventsProcessed: blackBox.length,
      findings: 1,
      verifiedFindings: 1,
      falsePositives: 0,
      errors: 0,
      evidenceCount: 1
    };

    const report = {
      missionId,
      correlationId,
      state,
      transitions,
      objective,
      targetScope,
      agentSnapshot: { id: agent.id, health: agent.health, successRate: agent.successRate, avgLatency: agent.avgLatency },
      finding,
      metrics,
      blackBoxCount: blackBox.length,
      blackBoxHeadHash: blackBox[blackBox.length - 1].hash,
      generatedAt: new Date().toISOString()
    };

    appendBox("Report", { missionId, correlationId, headHash: report.blackBoxHeadHash });
    const reportPath = path.join(this.outDir, `${missionId}.json`);
    fs.writeFileSync(reportPath, JSON.stringify({ report, blackBox }, null, 2));

    return { ok: true, reportPath, report };
  }
}

module.exports = {
  MarauderPipelineV2,
  MISSION_STATES,
  FINDING_LIFECYCLE,
  generateMissionId,
  generateCorrelationId,
  buildUniversalEvidence
};
