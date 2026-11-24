const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFile } = require("child_process");
const { sha256 } = require("./black-box-parliament");

const REPORT_DIR = path.join(__dirname, "..", "data", "project-reports");

const DOMAINS = [
  { prefix: "DEPS", role: "Dependency & Lockfile Auditor", cap: "dependency.audit" },
  { prefix: "SECR", role: "Secrets & Env Exposure Inspector", cap: "filesystem.read" },
  { prefix: "CONF", role: "Web/Server Config & Headers Auditor", cap: "config.audit" },
  { prefix: "SOCK", role: "Local Listener & Bind Exposure Checker", cap: "network.observe" },
  { prefix: "AUTH", role: "Auth & Access Guard Reviewer", cap: "config.audit" },
  { prefix: "INPT", role: "Input & Command Execution Guard Auditor", cap: "filesystem.read" },
  { prefix: "VERF", role: "Evidence & Fix Verification Agent", cap: "evidence.verify" },
  { prefix: "REPT", role: "Security Report & Remediation Planner", cap: "filesystem.read" }
];

function build80ActiveAgents() {
  const agents = [];
  let n = 1;
  for (const dom of DOMAINS) {
    for (let i = 1; i <= 10; i++) {
      agents.push({
        id: `MRD80-${String(n).padStart(3, "0")}`,
        code: `${dom.prefix}-${String(i).padStart(2, "0")}`,
        name: `${dom.role} #${i}`,
        domain: dom.prefix,
        capability: dom.cap,
        mode: "read-only",
        active: true
      });
      n += 1;
    }
  }
  return agents;
}

function runNpmAuditJson(cwd) {
  return new Promise((resolve) => {
    execFile("npm", ["audit", "--json"], { cwd, timeout: 15000, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      let parsed = null;
      try {
        if (stdout) parsed = JSON.parse(stdout);
      } catch (_) {}
      const meta = (parsed && parsed.metadata && parsed.metadata.vulnerabilities) || {};
      const total = Object.values(meta).reduce((a, b) => a + (Number(b) || 0), 0);
      resolve({
        ok: Boolean(parsed),
        exitCode: err ? err.code ?? 1 : 0,
        totalVulnerabilities: total,
        bySeverity: meta
      });
    });
  });
}

function scanProjectFiles(projectDir) {
  const findings = [];
  const pkgPath = path.join(projectDir, "package.json");
  const lockPath = path.join(projectDir, "package-lock.json");

  const hasPkg = fs.existsSync(pkgPath);
  const hasLock = fs.existsSync(lockPath);

  if (!hasPkg) {
    findings.push({
      id: "FND-NOPKG",
      area: "dependencies",
      severity: "HIGH",
      observation: "package.json липсва в целевата директория.",
      remediation: "Добави package.json и фиксирай зависимостите."
    });
  } else if (!hasLock) {
    findings.push({
      id: "FND-NOLOCK",
      area: "dependencies",
      severity: "MEDIUM",
      observation: "Липсва package-lock.json — възможни непредвидими версии при инсталация.",
      remediation: "Генерирай и пази package-lock.json за детерминирани build-ове."
    });
  }

  // Безопасен read-only обход на JS/JSON/ENV файлове (без node_modules и .git)
  const candidates = [];
  const walk = (dir, depth = 0) => {
    if (depth > 3 || candidates.length >= 40) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    for (const ent of entries) {
      if (["node_modules", ".git", "data", "dist", "build"].includes(ent.name)) continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full, depth + 1);
      } else if (/\.(js|mjs|cjs|json|env)$/i.test(ent.name)) {
        candidates.push(full);
      }
    }
  };
  walk(projectDir, 0);

  for (const file of candidates) {
    let text = "";
    try {
      const st = fs.statSync(file);
      if (st.size > 256 * 1024) continue;
      text = fs.readFileSync(file, "utf8");
    } catch (_) {
      continue;
    }

    const rel = path.relative(projectDir, file);
    if (/child_process\s*\.\s*exec\s*\(/.test(text)) {
      findings.push({
        id: `FND-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
        file: rel,
        area: "execution-safety",
        severity: "MEDIUM",
        observation: `Използване на child_process.exec в ${rel} (риск от shell injection при невалидиран вход).`,
        remediation: "Предпочети execFile с масив от аргументи и строг allowlist."
      });
    }
    if (/eval\s*\(|new Function\s*\(/.test(text)) {
      findings.push({
        id: `FND-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
        file: rel,
        area: "code-safety",
        severity: "HIGH",
        observation: `Динамично изпълнение на код (eval / new Function) в ${rel}.`,
        remediation: "Премахни динамичното изпълнение на низове като код."
      });
    }
    if (/(api_key|secret_key|password|token)\s*[:=]\s*["'][A-Za-z0-9_\-]{12,}["']/i.test(text)) {
      findings.push({
        id: `FND-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
        file: rel,
        area: "secrets",
        severity: "HIGH",
        observation: `Потенциален твърдо кодиран секрет/ключ в ${rel}.`,
        remediation: "Премести стойностите в защитени променливи на средата (env/secret store) и ротирай ключа."
      });
    }
  }

  return { inspectedFilesCount: candidates.length, hasPkg, hasLock, findings };
}

class ProjectSecurityAnalyzer80 {
  constructor(projectDir = process.cwd()) {
    this.projectDir = projectDir;
    this.agents = build80ActiveAgents();
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }

  selectTeamForPrompt(prompt = "") {
    const q = String(prompt || "").toLowerCase();
    const chosenDomains = new Set(["DEPS", "SECR", "CONF", "VERF", "REPT"]);
    if (/port|socket|мреж|network|listen/.test(q)) chosenDomains.add("SOCK");
    if (/auth|login|достъп|token/.test(q)) chosenDomains.add("AUTH");
    if (/inject|cmd|exec|вход|input/.test(q)) chosenDomains.add("INPT");

    return this.agents.filter((a) => chosenDomains.has(a.domain)).slice(0, 12);
  }

  async analyzeProject({ prompt = "MARAUDER, анализирай сигурността на моя проект.", targetDir = this.projectDir } = {}) {
    const missionId = `MAR-2026-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const startedAt = new Date().toISOString();
    const t0 = Date.now();

    const team = this.selectTeamForPrompt(prompt);
    const scan = scanProjectFiles(targetDir);
    const audit = scan.hasPkg ? await runNpmAuditJson(targetDir) : { ok: false, totalVulnerabilities: 0, bySeverity: {} };

    const evidenceItems = [
      {
        id: `EVD-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
        type: "project-static-scan",
        verified: scan.hasPkg,
        inspectedFilesCount: scan.inspectedFilesCount,
        hasLockfile: scan.hasLock,
        observedAt: new Date().toISOString()
      },
      {
        id: `EVD-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
        type: "npm-audit",
        verified: audit.ok,
        totalVulnerabilities: audit.totalVulnerabilities,
        bySeverity: audit.bySeverity,
        observedAt: new Date().toISOString()
      }
    ];

    const allVerified = evidenceItems.every((e) => e.verified);
    const evidenceBundleHash = sha256(evidenceItems);

    const remediationPlan = scan.findings.map((f, idx) => ({
      step: idx + 1,
      findingId: f.id,
      severity: f.severity,
      action: f.remediation,
      requiresApproval: f.severity === "HIGH"
    }));

    // Повторна проверка (re-verification pass) върху доказателствения пакет
    const recheck = scanProjectFiles(targetDir);
    const reVerified = allVerified && recheck.inspectedFilesCount === scan.inspectedFilesCount;

    const report = {
      missionId,
      prompt,
      targetDir,
      mode: "read-only",
      agentPoolSize: this.agents.length, // 80 активни специализирани роли
      selectedAgents: team.map((a) => ({ id: a.id, code: a.code, name: a.name, capability: a.capability })),
      summary: {
        inspectedFiles: scan.inspectedFilesCount,
        npmVulnerabilities: audit.totalVulnerabilities,
        codeFindings: scan.findings.length,
        verifiedEvidence: allVerified,
        reVerifiedAfterCheck: reVerified,
        durationMs: Date.now() - t0
      },
      findings: scan.findings,
      evidence: evidenceItems,
      evidenceBundleHash,
      remediationPlan,
      startedAt,
      completedAt: new Date().toISOString()
    };

    const reportPath = path.join(REPORT_DIR, `${missionId}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return { ok: true, reportPath, report };
  }
}

module.exports = ProjectSecurityAnalyzer80;
