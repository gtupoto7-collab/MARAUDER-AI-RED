const crypto = require("crypto");

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts|rules)/i,
  /system\s*prompt|reveal\s+(your\s+)?(system|hidden)\s+instructions/i,
  /\b(jailbreak|dan\s+mode|developer\s+mode\s+enabled|bypass\s+policy)\b/i,
  /игнорирай\s+(всички\s+)?(предишни|горни)\s+(инструкции|правила)/i,
  /покажи\s+(системния\s+промпт|скритите\s+инструкции)/i,
  /изпълни\s+(команда|скрипт|shell)\s*:/i,
  /(api[_-]?key|secret[_-]?key|bearer\s+[A-Za-z0-9\-_.]{16,}|ghp_[A-Za-z0-9]{20,})/i
];

class PromptInjectionGuard {
  constructor() {
    this.blockedCount = 0;
  }

  inspectUntrusted(input, source = "external-input") {
    const raw = typeof input === "string" ? input : JSON.stringify(input ?? "");
    const matchedRules = [];

    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(raw)) {
        matchedRules.push(pattern.source);
      }
    }

    const suspicious = matchedRules.length > 0;
    if (suspicious) {
      this.blockedCount += 1;
    }

    const sanitizedText = raw
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .slice(0, 8000);

    return {
      id: `INJ-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      source,
      trustLevel: "UNTRUSTED_DATA_ONLY",
      treatAsExecutableInstruction: false,
      suspicious,
      action: suspicious ? "QUARANTINE_AND_STRIP_INSTRUCTIONS" : "ALLOW_AS_DATA",
      matchedRules,
      sanitizedText,
      inspectedAt: new Date().toISOString()
    };
  }
}

module.exports = PromptInjectionGuard;
