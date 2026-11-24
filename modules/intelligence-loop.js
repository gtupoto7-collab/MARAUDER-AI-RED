const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { sha256 } = require("./black-box-parliament");

const LOOP_DIR = path.join(__dirname, "..", "data", "intelligence-loop");
const STATE_FILE = path.join(LOOP_DIR, "loop-state.json");

const PROFILES = new Set([
  "local-control-plane",
  "offline",
  "air-gapped-lab",
  "sovereign",
  "private",
  "enterprise",
  "community",
  "research",
  "developer",
  "eu-security-profile",
  "bg-security-profile"
]);

class MarauderIntelligenceLoop {
  constructor({ profile = "bg-security-profile", offlineMode = false } = {}) {
    fs.mkdirSync(LOOP_DIR, { recursive: true });
    this.profile = PROFILES.has(profile) ? profile : "bg-security-profile";
    this.offlineMode = Boolean(offlineMode);
    this.state = this._loadState();
  }

  _loadState() {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    }
    const initial = {
      cycleCount: 0,
      routingWeights: {
        "SOC": 1.0,
        "DFIR": 1.0,
        "NETWORK": 1.0,
        "APPSEC": 1.0,
        "GOVERNANCE": 1.0
      },
      baselineThresholdScore: 45,
      pendingPolicyApprovals: [],
      history: []
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }

  _saveState() {
    fs.writeFileSync(STATE_FILE, JSON.stringify(this.state, null, 2));
  }

  runCycle({
    telemetryEvents = [],
    verifiedEvidence = [],
    proposedPolicyChange = null,
    remediationApproved = false
  } = {}) {
    this.state.cycleCount += 1;
    const cycleId = `LOOP-${String(this.state.cycleCount).padStart(5, "0")}`;
    const ts = new Date().toISOString();

    // 1. DETECT from telemetry
    const signals = (Array.isArray(telemetryEvents) ? telemetryEvents : []).filter(
      (e) => e && e.message && !/^(debug|trace)$/i.test(String(e.level || ""))
    );
    const highSignals = signals.filter((e) =>
      ["high", "critical", "medium"].includes(String(e.severity || "low").toLowerCase())
    );

    // 2. VERIFY against evidence
    const validEvidence = (Array.isArray(verifiedEvidence) ? verifiedEvidence : []).filter(
      (ev) => ev && ev.verified === true
    );
    const hasVerifiedProof = validEvidence.length > 0;

    // 3. REMEDIATE proposal & guarded execution
    const remediationProposal = {
      proposalId: `REM-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      requiresApproval: true,
      approved: Boolean(remediationApproved),
      action: hasVerifiedProof && highSignals.length > 0
        ? "harden-config-and-isolate-anomaly"
        : "maintain-read-only-baseline",
      verifiedBeforeRemediate: hasVerifiedProof
    };

    const remediationStatus = !remediationProposal.verifiedBeforeRemediate
      ? "SKIPPED_NO_VERIFIED_EVIDENCE"
      : remediationProposal.approved
        ? "VERIFIED_SAFE"
        : "AWAITING_OPERATOR_APPROVAL";

    // 4. LEARN & IMPROVE non-critical routing/baseline; queue critical policy changes for approval
    if (highSignals.length > 0 && hasVerifiedProof) {
      this.state.routingWeights.SOC = Number(Math.min(2.0, this.state.routingWeights.SOC + 0.05).toFixed(2));
      this.state.baselineThresholdScore = Math.max(30, this.state.baselineThresholdScore - 1);
    }

    let policyStatus = "NO_POLICY_CHANGE";
    if (proposedPolicyChange && proposedPolicyChange.rule) {
      if (proposedPolicyChange.critical === true && !proposedPolicyChange.approved) {
        policyStatus = "HELD_FOR_APPROVAL";
        this.state.pendingPolicyApprovals.push({
          cycleId,
          ts,
          ...proposedPolicyChange
        });
      } else {
        policyStatus = "APPLIED_NON_CRITICAL";
      }
    }

    const record = {
      cycleId,
      ts,
      profile: this.profile,
      offlineMode: this.offlineMode,
      stages: ["REAL_WORLD", "TELEMETRY", "MARAUDER", "DETECT", "LEARN", "VERIFY", "IMPROVE", "REMEDIATE", "SAFE"],
      telemetryCount: signals.length,
      highSignalCount: highSignals.length,
      verifiedEvidenceCount: validEvidence.length,
      remediationProposal,
      remediationStatus,
      policyStatus,
      learnedBaselineThreshold: this.state.baselineThresholdScore,
      digest: sha256({ cycleId, ts, signals: signals.length, validEvidence: validEvidence.length, remediationStatus })
    };

    this.state.history.push(record);
    if (this.state.history.length > 100) {
      this.state.history = this.state.history.slice(-100);
    }
    this._saveState();
    fs.writeFileSync(path.join(LOOP_DIR, `${cycleId}.json`), JSON.stringify(record, null, 2));

    return record;
  }
}

module.exports = MarauderIntelligenceLoop;
