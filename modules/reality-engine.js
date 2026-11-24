const crypto = require("crypto");

const AGENT_CAPABILITIES = new Set([
  "filesystem.read",
  "process.inspect",
  "network.observe",
  "logs.read",
  "security.scan",
  "sandbox.execute"
]);

class RealityEngine {
  constructor() {
    this.records = [];
    this.findings = [];
  }

  hasCapability(grantedCapabilities = [], requiredCapability = "") {
    if (!requiredCapability) return true;
    const set = new Set((grantedCapabilities || []).map((c) => String(c)));
    return set.has(String(requiredCapability));
  }

  recordExecution({
    command,
    target,
    agent,
    permission = "read-only",
    requiredCapability = "",
    grantedCapabilities = [],
    realOutput = "",
    evidence = [],
    verifiedBySystem = false
  }) {
    const cleanOutput = String(realOutput || "").trim();
    const cleanEvidence = Array.isArray(evidence)
      ? evidence.filter((e) => e && String(e).trim().length > 0)
      : [];

    const capOk = this.hasCapability(grantedCapabilities, requiredCapability);
    const hasRealProof = Boolean(cleanOutput) && cleanEvidence.length > 0 && Boolean(verifiedBySystem);

    const record = {
      id: `ACT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      command: String(command || ""),
      target: String(target || ""),
      timestamp: new Date().toISOString(),
      agent: String(agent || "unassigned"),
      permission: String(permission || "read-only"),
      requiredCapability: requiredCapability || null,
      capabilityAllowed: capOk,
      realOutput: cleanOutput,
      evidence: cleanEvidence,
      verifiedBySystem: Boolean(verifiedBySystem),
      result: hasRealProof ? "VERIFIED_FACT" : "UNVERIFIED_OR_NO_EVIDENCE"
    };

    this.records.push(record);
    return record;
  }

  createEvidenceFinding({
    codeNumber,
    severity = "LOW",
    claim,
    actualConfiguration = "",
    actualObservation = "",
    affectedAsset = "",
    verificationResult = "",
    confidence = 0,
    recommendedRemediation = "",
    executionId = null
  }) {
    const linked = executionId ? this.records.find((r) => r.id === executionId) : null;
    const hasEvidence =
      Boolean(String(actualObservation || actualConfiguration).trim()) &&
      Boolean(String(affectedAsset).trim()) &&
      Boolean(String(verificationResult).trim()) &&
      (!executionId || (linked && linked.result === "VERIFIED_FACT"));

    const num = codeNumber || Math.floor(1000 + Math.random() * 9000);
    const finding = {
      findingId: `FINDING #${num}`,
      severity: String(severity || "LOW").toUpperCase(),
      claim: String(claim || ""),
      status: hasEvidence ? "EVIDENCE_BACKED" : "REJECTED_NO_REAL_EVIDENCE",
      evidence: {
        actualConfiguration: String(actualConfiguration || ""),
        actualObservation: String(actualObservation || ""),
        affectedAsset: String(affectedAsset || ""),
        timestamp: new Date().toISOString(),
        verificationResult: String(verificationResult || "")
      },
      confidence: hasEvidence ? Math.min(Math.max(Number(confidence) || 0, 0), 100) : 0,
      recommendedRemediation: String(recommendedRemediation || ""),
      executionId: executionId || null
    };

    this.findings.push(finding);
    return finding;
  }

  getSummary() {
    const verifiedCount = this.records.filter((r) => r.result === "VERIFIED_FACT").length;
    const backedFindings = this.findings.filter((f) => f.status === "EVIDENCE_BACKED").length;
    return {
      totalExecutions: this.records.length,
      verifiedExecutions: verifiedCount,
      totalFindings: this.findings.length,
      evidenceBackedFindings: backedFindings,
      allowedCapabilities: Array.from(AGENT_CAPABILITIES)
    };
  }
}

module.exports = { RealityEngine, AGENT_CAPABILITIES };
