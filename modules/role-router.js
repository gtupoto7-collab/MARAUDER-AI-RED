const fs = require("fs");
const path = require("path");

const CATALOG_PATH = path.join(__dirname, "..", "data", "roles-500-catalog.json");

const KEYWORD_RULES = [
  {
    keywords: [
      "лог", "логове", "log", "logs", "siem", "edr", "xdr",
      "аномал", "инцидент", "incident", "triage", "timeline", "соц", "soc"
    ],
    domains: ["SOC / Incident Response"],
    terms: [
      "log", "siem", "edr", "xdr", "triage", "incident",
      "timeline", "alert", "event", "correlator", "soc"
    ]
  },
  {
    keywords: [
      "ioc", "cve", "att&ck", "mitre", "threat", "разузнав", "cti",
      "репутац", "domain", "dns", "ip", "hash", "apt", "ransomware", "ttps"
    ],
    domains: ["Threat Intelligence"],
    terms: [
      "ioc", "threat", "cti", "ttp", "att&ck", "reputation",
      "domain", "dns", "hash", "apt", "intelligence", "campaign"
    ]
  },
  {
    keywords: [
      "malware", "зловред", "yara", "sigma", "pe", "elf", "apk",
      "sandbox", "ghidra", "jadx", "capa", "volatility", "reverse",
      "памет", "memory", "unpack", "obfuscation"
    ],
    domains: ["Malware / Research"],
    terms: [
      "malware", "yara", "sigma", "static", "dynamic", "sandbox",
      "reverse", "memory", "analyzer", "classifier", "family"
    ]
  },
  {
    keywords: [
      "порт", "портове", "port", "ports", "мрежа", "network",
      "firewall", "zeek", "suricata", "packet", "трафик", "traffic",
      "tls", "vpn", "scan", "zero-trust", "segmentation"
    ],
    domains: ["Network / Infrastructure"],
    terms: [
      "network", "port", "service", "firewall", "zeek", "suricata",
      "packet", "traffic", "discovery", "mapper", "vpn", "tls"
    ]
  },
  {
    keywords: [
      "облак", "cloud", "aws", "azure", "gcp", "docker", "container",
      "kubernetes", "k8s", "ci/cd", "git", "sbom", "iac", "terraform", "helm"
    ],
    domains: ["Cloud / DevSecOps"],
    terms: [
      "cloud", "aws", "azure", "gcp", "kubernetes", "container",
      "docker", "ci/cd", "git", "sbom", "iac", "terraform", "devops"
    ]
  },
  {
    keywords: [
      "iam", "rbac", "abac", "identity", "самоличност", "достъп", "права",
      "mfa", "sso", "oauth", "token", "сесия", "session", "pam",
      "kerberos", "ldap", "active directory", "entra", "rotation", "credential"
    ],
    domains: ["Identity / Access"],
    terms: [
      "iam", "rbac", "abac", "identity", "privilege", "access",
      "token", "session", "mfa", "sso", "oauth", "pam", "credential", "directory"
    ]
  },
  {
    keywords: [
      "prompt", "prompt injection", "jailbreak", "mcp", "model", "модел",
      "hallucination", "халюцинац", "ai security", "ai safety", "agent guard",
      "memory poisoning", "context integrity", "output validator", "dlp"
    ],
    domains: ["AI / Agent Security", "Governance, Risk & AI Safety"],
    terms: [
      "prompt", "jailbreak", "mcp", "model", "agent", "memory",
      "context", "hallucination", "safety", "policy", "guard", "governance"
    ]
  },
  {
    keywords: [
      "sast", "dast", "sca", "appsec", "api", "web", "уеб", "graphql",
      "webhook", "upload", "headers", "fuzzing", "cwe", "pentest",
      "code review", "секрети в код", "secrets-in-code", "business logic"
    ],
    domains: ["AppSec / Authorized Security Testing"],
    terms: [
      "appsec", "sast", "dast", "sca", "api", "web", "code",
      "cwe", "cve", "fuzzing", "pentest", "headers", "authorization", "validation"
    ]
  },
  {
    keywords: [
      "forensics", "dfir", "криминалист", "диск", "disk", "registry",
      "prefetch", "chain-of-custody", "snapshot", "rollback", "recovery",
      "възстановяван", "postmortem", "root-cause", "artifact", "timeline forensics"
    ],
    domains: ["Forensics / Recovery"],
    terms: [
      "forensics", "dfir", "disk", "memory", "artifact", "recovery",
      "snapshot", "timeline", "custody", "root-cause", "postmortem", "resilience"
    ]
  },
  {
    keywords: [
      "red team", "red-team", "threat hunting", "threat hunt", "атака",
      "adversary", "emulation", "attack-path", "honeypot", "deception",
      "rf", "wireless", "ble", "nfc", "firmware", "ics", "ot", "scada", "plc"
    ],
    domains: ["Red Team / Threat Hunting & Specialized Lab"],
    terms: [
      "red-team", "hunt", "adversary", "emulation", "attack-path",
      "honeypot", "firmware", "ics", "ot", "scada", "wireless", "purple-team"
    ]
  }
];

function loadRolesCatalog(customPath = CATALOG_PATH) {
  if (!fs.existsSync(customPath)) {
    return [];
  }
  const parsed = JSON.parse(fs.readFileSync(customPath, "utf8"));
  return Array.isArray(parsed) ? parsed : (parsed.roles || []);
}

function selectRolesForTask(taskDescription, { limit = 5, catalogPath = CATALOG_PATH } = {}) {
  const text = String(taskDescription || "").trim();
  const lower = text.toLowerCase();
  const roles = loadRolesCatalog(catalogPath);

  if (!text || roles.length === 0) {
    return [];
  }

  const matchedDomains = new Set();
  const matchedKeywords = new Set();
  const boostedTerms = new Set();

  for (const rule of KEYWORD_RULES) {
    const hit = rule.keywords.some((kw) => lower.includes(kw.toLowerCase()));
    if (hit) {
      for (const kw of rule.keywords) {
        if (lower.includes(kw.toLowerCase())) matchedKeywords.add(kw);
      }
      for (const dom of rule.domains) matchedDomains.add(dom);
      for (const trm of rule.terms) boostedTerms.add(trm.toLowerCase());
    }
  }

  const words = lower
    .replace(/[^\p{L}\p{N}_-]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const scored = roles.map((role) => {
    const roleName = String(role.roleName || "");
    const domain = String(role.domain || "");
    const nameLower = roleName.toLowerCase();
    const domainLower = domain.toLowerCase();

    let score = 0;
    const reasons = [];

    if (matchedDomains.has(domain)) {
      score += 10;
      reasons.push(`домейн: ${domain}`);
    }

    for (const kw of matchedKeywords) {
      if (nameLower.includes(kw.toLowerCase()) || domainLower.includes(kw.toLowerCase())) {
        score += 8;
        reasons.push(`ключова дума: ${kw}`);
      }
    }

    for (const trm of boostedTerms) {
      if (nameLower.includes(trm)) {
        score += 5;
        reasons.push(`съвпадение в роля: ${trm}`);
      }
    }

    for (const word of words) {
      if (nameLower.includes(word)) {
        score += 3;
      }
    }

    return {
      id: role.id,
      roleName: role.roleName,
      domain: role.domain,
      defaultPermission: role.defaultPermission || "read-only",
      requiresApprovalForChange: Boolean(role.requiresApprovalForChange ?? true),
      score,
      reasons: Array.from(new Set(reasons))
    };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, Math.max(1, Number(limit) || 5));
}

module.exports = {
  loadRolesCatalog,
  selectRolesForTask
};
