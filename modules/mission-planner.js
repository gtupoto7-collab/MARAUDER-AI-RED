const crypto = require("crypto");
const PromptInjectionGuard = require("./prompt-injection-guard");

const ALLOWED_SCOPES = new Set([
  "approved-project",
  "verified-local-lab",
  "localhost",
  "127.0.0.1"
]);

class MissionPlanner {
  constructor({ guard = null } = {}) {
    this.guard = guard || new PromptInjectionGuard();
  }

  planFromNaturalLanguage(rawInput = "", { scope = "approved-project", policyApproved = true } = {}) {
    const guardResult = this.guard.inspectUntrusted(rawInput, "user-mission-prompt");
    const text = guardResult.sanitizedText.toLowerCase();

    const cleanScope = ALLOWED_SCOPES.has(scope) ? scope : "approved-project";
    const agents = ["DependencyAuditor", "ConfigAuditor", "TLSInspector", "CodeSecurityAgent"];

    if (/port|socket|мреж|network|listen/.test(text)) {
      agents.push("NetworkObserver");
    }
    if (/secret|ключ|token|env/.test(text)) {
      agents.push("SecretScanner");
    }

    const missionType = /пентест|pentest|attack|атака/.test(text)
      ? "AUTHORIZED_LAB_SECURITY_ASSESSMENT"
      : "PROJECT_SECURITY_AUDIT";

    const plan = {
      planId: `PLN-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      mission: missionType,
      scope: cleanScope,
      mode: "READ_ONLY",
      agents: Array.from(new Set(agents)),
      evidenceRequired: true,
      approvalRequired: true,
      guardCheck: {
        id: guardResult.id,
        suspicious: guardResult.suspicious,
        action: guardResult.action
      }
    };

    const policyValidation = {
      validatedBy: "PolicyEngine",
      allowed: Boolean(policyApproved) && !guardResult.suspicious && ALLOWED_SCOPES.has(cleanScope),
      reason: guardResult.suspicious
        ? "BLOCKED_PROMPT_INJECTION_SIGNAL"
        : !policyApproved
          ? "POLICY_NOT_APPROVED"
          : "VALIDATED_READ_ONLY_PLAN",
      checkedAt: new Date().toISOString()
    };

    return {
      ok: policyValidation.allowed,
      readyToExecute: false,
      requiresExplicitApproval: true,
      plan,
      policyValidation
    };
  }
}

module.exports = MissionPlanner;
