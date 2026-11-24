const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_SCOPE_ALLOWLIST = new Set([
  "localhost",
  "127.0.0.1",
  "verified-local-lab",
  "admiralerror-local-lab"
]);

function sha256(obj) {
  return crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}

class Mission {
  constructor({ missionId, targetScope, objective }) {
    if (!targetScope || !objective) {
      throw new Error("MISSION_REQUIRES_SCOPE_AND_OBJECTIVE");
    }
    this.missionId = missionId || `MSN-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    this.targetScope = String(targetScope).trim();
    this.objective = String(objective).trim();
    this.status = "CREATED";
    this.startedAt = new Date().toISOString();
    this.completedAt = null;
  }

  setStatus(nextStatus) {
    this.status = nextStatus;
    if (["COMPLETED", "REJECTED", "FAILED"].includes(nextStatus)) {
      this.completedAt = new Date().toISOString();
    }
  }
}

class BlackBox {
  constructor(mission, baseDir = path.join(__dirname, "..", "data", "blackbox-v2")) {
    this.mission = mission;
    this.baseDir = baseDir;
    this.events = [];
    this.evidences = [];
    this.decisions = [];
    this.chain = [];
    this.lastHash = "GENESIS";
    this.finalized = false;
    this.missionDigest = null;
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  _commitRecord(kind, payload) {
    if (this.finalized) {
      throw new Error("BLACKBOX_ALREADY_FINALIZED");
    }
    const record = {
      index: this.chain.length,
      missionId: this.mission.missionId,
      ts: new Date().toISOString(),
      kind,
      payload,
      prevHash: this.lastHash
    };
    record.hash = sha256(record);
    this.lastHash = record.hash;
    this.chain.push(record);
    return Object.freeze(record);
  }

  appendEvent(event) {
    const rec = this._commitRecord("EVENT", event);
    this.events.push(rec);
    return rec;
  }

  appendEvidence(evidence) {
    if (!evidence || !evidence.verified) {
      throw new Error("FINDING_REQUIRES_VERIFIED_EVIDENCE");
    }
    const rec = this._commitRecord("EVIDENCE", {
      ...evidence,
      evidenceHash: evidence.evidenceHash || sha256(evidence)
    });
    this.evidences.push(rec);
    return rec;
  }

  appendDecision(decision) {
    const rec = this._commitRecord("DECISION", decision);
    this.decisions.push(rec);
    return rec;
  }

  verifyIntegrity() {
    let prev = "GENESIS";
    for (const item of this.chain) {
      if (item.prevHash !== prev) return { valid: false, reason: `Broken prevHash at ${item.index}` };
      const { hash, ...rest } = item;
      if (sha256(rest) !== hash) return { valid: false, reason: `Tampered payload at ${item.index}` };
      prev = hash;
    }
    return { valid: true, records: this.chain.length, headHash: this.lastHash };
  }

  finalizeMission(status = "COMPLETED") {
    this.mission.setStatus(status);
    const summaryPayload = {
      missionId: this.mission.missionId,
      status: this.mission.status,
      completedAt: this.mission.completedAt,
      eventCount: this.events.length,
      evidenceCount: this.evidences.length,
      decisionCount: this.decisions.length,
      headHash: this.lastHash
    };
    const finalRec = this._commitRecord("FINALIZE", summaryPayload);
    this.finalized = true;
    this.missionDigest = finalRec.hash;

    const outPath = path.join(this.baseDir, `${this.mission.missionId}.json`);
    fs.writeFileSync(outPath, JSON.stringify(this.exportMission(), null, 2));
    return { outPath, missionDigest: this.missionDigest, integrity: this.verifyIntegrity() };
  }

  exportMission() {
    return {
      mission: { ...this.mission },
      integrity: this.verifyIntegrity(),
      missionDigest: this.missionDigest,
      events: this.events,
      evidences: this.evidences,
      decisions: this.decisions,
      chain: this.chain
    };
  }
}

class Parliament {
  constructor({ allowedTargets = DEFAULT_SCOPE_ALLOWLIST, minQuorum = 2, maxAutoRisk = "MEDIUM" } = {}) {
    this.allowedTargets = allowedTargets;
    this.minQuorum = minQuorum;
    this.riskOrder = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
    this.maxAutoRisk = maxAutoRisk;
  }

  propose({ action, targetScope, agentId, capability = "read_only" }) {
    return {
      proposalId: `PRP-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      stage: "PROPOSED",
      action,
      targetScope,
      agentId,
      capability,
      proposedAt: new Date().toISOString()
    };
  }

  verifyEvidence(evidence) {
    if (!evidence || !evidence.verified) {
      throw new Error("FINDING_REQUIRES_VERIFIED_EVIDENCE");
    }
    return {
      ok: true,
      stage: "EVIDENCE_CHECK",
      evidenceHash: evidence.evidenceHash || sha256(evidence)
    };
  }

  evaluateRisk({ severity = "LOW", mutating = false }) {
    const sev = String(severity).toUpperCase();
    const level = this.riskOrder[sev] ? sev : "MEDIUM";
    const effectiveLevel = mutating && this.riskOrder[level] < 3 ? "HIGH" : level;
    return {
      stage: "RISK_CHECK",
      level: effectiveLevel,
      requiresExtraReview: this.riskOrder[effectiveLevel] > this.riskOrder[this.maxAutoRisk]
    };
  }

  evaluatePolicy(proposal, riskAssessment) {
    const inScope = this.allowedTargets.has(String(proposal.targetScope || "").trim());
    const allowedCap = ["read_only", "filesystem.read", "process.inspect", "network.observe", "security.scan"].includes(
      proposal.capability
    );
    const allowed = inScope && allowedCap && !riskAssessment.requiresExtraReview;
    return {
      stage: "POLICY_CHECK",
      inScope,
      allowedCap,
      allowed,
      reason: !inScope
        ? "TARGET_OUT_OF_SCOPE"
        : !allowedCap
          ? "CAPABILITY_NOT_ALLOWED"
          : riskAssessment.requiresExtraReview
            ? "RISK_ABOVE_AUTO_THRESHOLD"
            : "POLICY_PERMITTED"
    };
  }

  quorum(votes = []) {
    const approvals = votes.filter((v) => v && v.approve === true);
    const hasVerifier = approvals.some((v) => /verifier|evidence|policy/i.test(String(v.role || "")));
    const passed = approvals.length >= this.minQuorum && hasVerifier;
    return {
      stage: "QUORUM",
      approvals: approvals.length,
      required: this.minQuorum,
      hasVerifier,
      passed
    };
  }

  authorize({ proposal, evidence, risk, policy, quorumResult, blackBox }) {
    const evCheck = this.verifyEvidence(evidence);
    const authorized = Boolean(evCheck.ok && policy.allowed && quorumResult.passed);
    const decision = {
      stage: authorized ? "AUTHORIZED" : "DENIED",
      proposalId: proposal.proposalId,
      targetScope: proposal.targetScope,
      riskLevel: risk.level,
      policyReason: policy.reason,
      quorumPassed: quorumResult.passed,
      evidenceHash: evCheck.evidenceHash,
      authorized
    };
    if (blackBox) {
      blackBox.appendDecision(decision);
    }
    return decision;
  }
}

class EventPipeline {
  constructor(storageDir = path.join(__dirname, "..", "data", "blackbox-v2")) {
    this.storageDir = storageDir;
    this.seenHashes = new Set();
    fs.mkdirSync(path.join(this.storageDir, "hot"), { recursive: true });
    fs.mkdirSync(path.join(this.storageDir, "warm"), { recursive: true });
    fs.mkdirSync(path.join(this.storageDir, "cold"), { recursive: true });
  }

  filter(rawEvents = []) {
    return rawEvents.filter((ev) => {
      if (!ev || typeof ev !== "object") return false;
      const lvl = String(ev.level || "info").toLowerCase();
      return lvl !== "debug" && lvl !== "trace" && Boolean(ev.message);
    });
  }

  normalize(events = []) {
    return events.map((ev) => ({
      ts: ev.ts || new Date().toISOString(),
      source: String(ev.source || "sensor").trim(),
      asset: String(ev.asset || "verified-local-lab").trim(),
      severity: String(ev.severity || "low").toUpperCase(),
      category: String(ev.category || "telemetry").toLowerCase(),
      message: String(ev.message).trim()
    }));
  }

  deduplicate(normalizedEvents = []) {
    const unique = [];
    for (const ev of normalizedEvents) {
      const h = sha256({ s: ev.source, a: ev.asset, m: ev.message, c: ev.category });
      if (this.seenHashes.has(h)) continue;
      this.seenHashes.add(h);
      unique.push({ ...ev, dedupHash: h });
    }
    return unique;
  }

  correlate(dedupedEvents = []) {
    const byAsset = new Map();
    for (const ev of dedupedEvents) {
      const list = byAsset.get(ev.asset) || [];
      list.push(ev);
      byAsset.set(ev.asset, list);
    }
    return dedupedEvents.map((ev) => {
      const assetEvents = byAsset.get(ev.asset) || [];
      return {
        ...ev,
        correlatedCountOnAsset: assetEvents.length,
        correlatedSpike: assetEvents.length >= 2
      };
    });
  }

  score(correlatedEvents = []) {
    const weights = { LOW: 15, MEDIUM: 45, HIGH: 75, CRITICAL: 95 };
    return correlatedEvents
      .map((ev) => {
        const base = weights[ev.severity] || 15;
        const boost = ev.correlatedSpike ? 15 : 0;
        const scoreVal = Math.min(100, base + boost);
        return { ...ev, riskScore: scoreVal };
      })
      .sort((a, b) => b.riskScore - a.riskScore);
  }

  routeTiers(scoredEvents = [], dateKey = new Date().toISOString().slice(0, 10)) {
    const hot = scoredEvents.filter((e) => e.riskScore >= 45);
    const warm = scoredEvents.filter((e) => e.riskScore < 45);
    fs.appendFileSync(path.join(this.storageDir, "hot", `${dateKey}.jsonl`), hot.map((x) => JSON.stringify(x)).join("\n") + (hot.length ? "\n" : ""));
    fs.appendFileSync(path.join(this.storageDir, "warm", `${dateKey}.jsonl`), warm.map((x) => JSON.stringify(x)).join("\n") + (warm.length ? "\n" : ""));
    return { hotCount: hot.length, warmCount: warm.length, coldArchiveReady: true };
  }

  archiveWarmToCold(dateKey) {
    const warmFile = path.join(this.storageDir, "warm", `${dateKey}.jsonl`);
    if (!fs.existsSync(warmFile)) return { archived: false, reason: "NO_WARM_FILE" };
    const coldFile = path.join(this.storageDir, "cold", `${dateKey}.jsonl`);
    fs.appendFileSync(coldFile, fs.readFileSync(warmFile, "utf8"));
    return { archived: true, coldFile };
  }
}

class ReplayEngine {
  constructor(parliament = new Parliament()) {
    this.parliament = parliament;
  }

  replay(exportedMission) {
    if (!exportedMission || !exportedMission.mission) {
      throw new Error("INVALID_EXPORTED_MISSION");
    }
    const { mission, evidences = [], decisions = [], missionDigest } = exportedMission;
    const firstEvidence = evidences[0] && evidences[0].payload ? evidences[0].payload : null;

    let evidenceVerified = false;
    try {
      if (firstEvidence) {
        this.parliament.verifyEvidence(firstEvidence);
        evidenceVerified = true;
      }
    } catch (_) {
      evidenceVerified = false;
    }

    const risk = this.parliament.evaluateRisk({ severity: "LOW", mutating: false });
    const policy = this.parliament.evaluatePolicy(
      { action: mission.objective, targetScope: mission.targetScope, capability: "read_only" },
      risk
    );
    const quorumResult = this.parliament.quorum([
      { role: "Policy Agent", approve: policy.allowed },
      { role: "Second-Agent Verifier", approve: evidenceVerified }
    ]);

    const replayedOutcome = evidenceVerified && policy.allowed && quorumResult.passed ? "AUTHORIZED" : "DENIED";
    const originalOutcome = decisions[0] && decisions[0].payload ? decisions[0].payload.stage : "UNKNOWN";

    return {
      missionId: mission.missionId,
      originalMissionDigest: missionDigest,
      replayedOutcome,
      originalOutcome,
      matchesOriginal: replayedOutcome === originalOutcome,
      evidenceVerified,
      policyReason: policy.reason,
      quorumPassed: quorumResult.passed
    };
  }
}

module.exports = {
  Mission,
  BlackBox,
  Parliament,
  EventPipeline,
  ReplayEngine,
  sha256
};
