class PolicyEngine {
  constructor({ allowedScopes = ["local-wsl", "approved-lab", "owned-lab", "bg-owned-web"] } = {}) {
    this.allowedScopes = new Set(allowedScopes.map(String));
  }

  assessRiskScore(normalized = {}) {
    if (!normalized || typeof normalized !== "object") return { score: 20, level: "low" };

    if (normalized.check === "dependency-audit") {
      const v = normalized.vulnerabilities || {};
      const score = Math.min(
        100,
        (v.critical || 0) * 35 + (v.high || 0) * 20 + (v.moderate || 0) * 10 + (v.low || 0) * 3 + (normalized.project?.lockfileMismatch ? 15 : 0)
      );
      return { score, level: score >= 65 ? "high" : (score >= 30 ? "medium" : "low") };
    }

    if (normalized.check === "local-listeners") {
      const exposed = (normalized.listeners || []).filter((l) => l.exposedWildcard && ![80, 443].includes(l.port));
      const score = Math.min(100, exposed.length * 22);
      return { score, level: score >= 60 ? "high" : (score >= 22 ? "medium" : "low") };
    }

    if (normalized.check === "config-hygiene-audit") {
      const score = Math.min(100, (normalized.highCount || 0) * 30 + (normalized.mediumCount || 0) * 12);
      return { score, level: score >= 60 ? "high" : (score >= 20 ? "medium" : "low") };
    }

    if (normalized.check === "tls-http-inspector") {
      const missing = (normalized.missingHeaders || []).length;
      let score = normalized.protocol !== "https:" ? 45 : 10;
      score += missing * 10;
      if (typeof normalized.tlsCertificate?.daysRemaining === "number" && normalized.tlsCertificate.daysRemaining < 14) {
        score = Math.max(score, 80);
      }
      score = Math.min(100, score);
      return { score, level: score >= 70 ? "high" : (score >= 35 ? "medium" : "low") };
    }

    if (normalized.riskLevel === "high") return { score: 82, level: "high" };
    if (normalized.riskLevel === "medium") return { score: 55, level: "medium" };
    return { score: 15, level: "low" };
  }

  evaluateAction({ targetScope, mode = "read-only", explicitApproval = false, normalized = null }) {
    if (!this.allowedScopes.has(String(targetScope || ""))) {
      return { allowed: false, code: "OUT_OF_SCOPE", risk: { score: 90, level: "high" } };
    }
    const risk = this.assessRiskScore(normalized);
    if (mode !== "read-only" && !explicitApproval) {
      return { allowed: false, code: "NEEDS_APPROVAL", risk };
    }
    return { allowed: true, code: "PERMITTED", risk };
  }
}

module.exports = { PolicyEngine };
