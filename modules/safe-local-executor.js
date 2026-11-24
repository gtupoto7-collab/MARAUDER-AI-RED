const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const tls = require("tls");
const http = require("http");
const https = require("https");

const SAFE_CHECKS = {
  "node-version": {
    bin: "node",
    args: ["-v"],
    mode: "read-only",
    requiredCapability: "process.inspect",
    description: "Проверка на версията на локалния Node.js runtime"
  },
  "git-version": {
    bin: "git",
    args: ["--version"],
    mode: "read-only",
    requiredCapability: "process.inspect",
    description: "Проверка на версията на Git"
  },
  "git-status-short": {
    bin: "git",
    args: ["status", "--short", "--branch"],
    mode: "read-only",
    requiredCapability: "filesystem.read",
    description: "Read-only преглед на локалното Git състояние"
  },
  "uname-info": {
    bin: "uname",
    args: ["-s", "-r", "-m"],
    mode: "read-only",
    requiredCapability: "process.inspect",
    description: "Read-only проверка на ядрото и архитектурата"
  },
  "network-interfaces": {
    bin: "ip",
    args: ["addr", "show", "up"],
    mode: "read-only",
    requiredCapability: "network.observe",
    description: "Read-only преглед на активните мрежови интерфейси"
  },
  "dependency-audit": {
    bin: "npm",
    args: ["audit", "--json"],
    mode: "read-only",
    requiredCapability: "filesystem.read",
    description: "Read-only одит на npm зависимости, уязвимости и lockfile състояние"
  },
  "local-listeners": {
    bin: "ss",
    args: ["-tulpn"],
    mode: "read-only",
    requiredCapability: "network.observe",
    description: "Read-only преглед на локалните слушащи портове и процеси"
  },
  "config-hygiene-audit": {
    kind: "internal",
    mode: "read-only",
    requiredCapability: "filesystem.read",
    description: "Read-only проверка на конфигурация и код за рискови шаблони"
  },
  "tls-http-inspector": {
    kind: "internal",
    mode: "read-only",
    requiredCapability: "network.observe",
    description: "Read-only проверка на TLS сертификат и HTTP security headers върху разрешен URL"
  }
};

function execCommandAsync(bin, args, { cwd, timeoutMs, signal }) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = execFile(
      bin,
      args,
      {
        cwd,
        timeout: Math.min(Math.max(Number(timeoutMs) || 15000, 500), 60000),
        maxBuffer: 2 * 1024 * 1024,
        windowsHide: true
      },
      (error, stdout, stderr) => {
        const durationMs = Date.now() - startedAt;
        const cleanStdout = String(stdout || "").trim();
        const cleanStderr = String(stderr || "").trim();
        const exitCode = error && typeof error.code === "number"
          ? error.code
          : (error ? 1 : 0);
        const abortedBySignal = Boolean(signal && signal.aborted) || Boolean(error && error.killed);
        resolve({
          error,
          stdout: cleanStdout,
          stderr: cleanStderr,
          exitCode,
          durationMs,
          abortedBySignal
        });
      }
    );

    if (signal) {
      if (signal.aborted) {
        try { child.kill("SIGTERM"); } catch {}
      } else {
        signal.addEventListener("abort", () => {
          try { child.kill("SIGTERM"); } catch {}
        }, { once: true });
      }
    }
  });
}

function normalizeDependencyAudit(cwd, rawResult) {
  const pkgPath = path.join(cwd, "package.json");
  const lockPath = path.join(cwd, "package-lock.json");
  const hasPackageJson = fs.existsSync(pkgPath);
  const hasLockfile = fs.existsSync(lockPath);

  const pkgMeta = {
    name: path.basename(cwd),
    depsCount: 0,
    devDepsCount: 0,
    lockfileMismatch: false,
    missingInLock: []
  };

  if (hasPackageJson) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      const deps = Object.keys(pkg.dependencies || {});
      const devDeps = Object.keys(pkg.devDependencies || {});
      pkgMeta.name = pkg.name || pkgMeta.name;
      pkgMeta.depsCount = deps.length;
      pkgMeta.devDepsCount = devDeps.length;

      if (hasLockfile) {
        const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
        const rootLock = lock.packages && lock.packages[""] ? lock.packages[""] : lock;
        const lockDeps = Object.keys(rootLock.dependencies || {});
        const missingInLock = deps.filter((d) => !lockDeps.includes(d));
        pkgMeta.lockfileMismatch = missingInLock.length > 0;
        pkgMeta.missingInLock = missingInLock;
      } else {
        pkgMeta.lockfileMismatch = deps.length > 0;
        pkgMeta.missingInLock = deps;
      }
    } catch (err) {
      pkgMeta.parseError = err.message;
    }
  }

  const auditSummary = { critical: 0, high: 0, moderate: 0, low: 0, total: 0 };
  const vulnerablePackages = [];

  if (rawResult.stdout) {
    try {
      const parsedAudit = JSON.parse(rawResult.stdout);
      const vulns = parsedAudit.vulnerabilities || {};
      for (const [pkgName, info] of Object.entries(vulns)) {
        const sev = String((info && info.severity) || "low").toLowerCase();
        if (sev === "critical") auditSummary.critical++;
        else if (sev === "high") auditSummary.high++;
        else if (sev === "moderate" || sev === "medium") auditSummary.moderate++;
        else auditSummary.low++;

        vulnerablePackages.push({
          package: pkgName,
          severity: sev,
          isDirect: Boolean(info && info.isDirect),
          fixAvailable: Boolean(info && info.fixAvailable)
        });
      }
      auditSummary.total = vulnerablePackages.length;
    } catch {
      // Ако npm audit не върне JSON, пазим метаданните от package.json / lockfile
    }
  }

  const riskLevel = auditSummary.critical > 0 || auditSummary.high > 0
    ? "high"
    : (auditSummary.moderate > 0 || pkgMeta.lockfileMismatch ? "medium" : "low");

  return {
    check: "dependency-audit",
    mode: "read-only",
    hasPackageJson,
    hasLockfile,
    project: pkgMeta,
    vulnerabilities: auditSummary,
    vulnerablePackages: vulnerablePackages.slice(0, 25),
    riskLevel
  };
}

function parseListenersOutput(rawText) {
  const lines = String(rawText || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const listeners = [];
  const commonServices = {
    22: "ssh",
    53: "dns",
    80: "http",
    443: "https",
    3000: "web-app",
    5432: "postgres",
    6379: "redis",
    8080: "http-alt"
  };

  for (const line of lines) {
    if (/^(Netid|Proto|State|Recv-Q)/i.test(line)) continue;
    const protoMatch = line.match(/^(tcp|udp|tcp6|udp6)\b/i);
    const proto = protoMatch ? protoMatch[1].toLowerCase() : "socket";

    const tokens = line.split(/\s+/);
    const endpoint = tokens.find((t) =>
      /^(?:\[[^\]]+\]|(?:\d{1,3}\.){3}\d{1,3}|\*):(?:\d+|\*)$/.test(t)
    ) || "";

    if (!endpoint) continue;
    const lastColon = endpoint.lastIndexOf(":");
    const bindAddress = endpoint.slice(0, lastColon).replace(/^\[|\]$/g, "");
    const portNum = Number(endpoint.slice(lastColon + 1));
    if (!Number.isFinite(portNum) || portNum <= 0) continue;

    const procMatch = line.match(/users:\(\("([^"]+)",pid=(\d+)/);
    const processName = procMatch ? procMatch[1] : "unknown";
    const pid = procMatch ? Number(procMatch[2]) : null;
    const service = commonServices[portNum] || "custom-service";
    const exposedWildcard = bindAddress === "0.0.0.0" || bindAddress === "::" || bindAddress === "*";

    const risk = exposedWildcard && ![80, 443].includes(portNum)
      ? "medium"
      : (exposedWildcard ? "low" : "info");

    listeners.push({
      proto,
      endpoint: `${bindAddress}:${portNum}`,
      bindAddress,
      port: portNum,
      process: processName,
      pid,
      service,
      exposedWildcard,
      risk
    });
  }

  return {
    check: "local-listeners",
    mode: "read-only",
    count: listeners.length,
    listeners
  };
}

function runConfigHygieneAudit(cwd) {
  const findings = [];
  const allowedExts = new Set([".js", ".mjs", ".cjs", ".ts", ".json", ".env.example", ".sh", ".yml", ".yaml"]);
  const ignoreDirs = new Set(["node_modules", ".git", "dist", "build", ".next"]);

  const gitignorePath = path.join(cwd, ".gitignore");
  if (!fs.existsSync(gitignorePath)) {
    findings.push({
      file: ".gitignore",
      rule: "missing-gitignore",
      severity: "medium",
      detail: "Липсва .gitignore файл в корена на проекта."
    });
  } else {
    const gi = fs.readFileSync(gitignorePath, "utf8");
    if (!gi.includes(".env")) {
      findings.push({
        file: ".gitignore",
        rule: "env-not-ignored",
        severity: "high",
        detail: ".env не е изрично посочен в .gitignore."
      });
    }
  }

  const rules = [
    { id: "dynamic-eval", severity: "high", regex: /\beval\s*\(|\bnew\s+Function\s*\(/, detail: "Динамично изпълнение на код (eval / new Function)." },
    { id: "wildcard-bind", severity: "medium", regex: /["']0\.0\.0\.0["']/, detail: "Слушане на всички интерфейси (0.0.0.0)." },
    { id: "hardcoded-secret-like", severity: "high", regex: /(api[_-]?key|secret|password|token)\s*[:=]\s*["'][A-Za-z0-9_\-]{12,}["']/i, detail: "Възможен твърдо записан ключ/секрет в код." },
    { id: "shell-true", severity: "medium", regex: /shell\s*:\s*true/, detail: "Използване на shell: true при стартиране на външен процес." }
  ];

  let filesScanned = 0;
  function walk(dir) {
    if (filesScanned >= 250) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (filesScanned >= 250) break;
      if (ent.isDirectory()) {
        if (!ignoreDirs.has(ent.name)) walk(path.join(dir, ent.name));
      } else if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase();
        if (!allowedExts.has(ext) && ent.name !== ".env.example") continue;
        const full = path.join(dir, ent.name);
        let content = "";
        try {
          const stat = fs.statSync(full);
          if (stat.size > 512 * 1024) continue;
          content = fs.readFileSync(full, "utf8");
        } catch {
          continue;
        }
        filesScanned++;
        const rel = path.relative(cwd, full) || ent.name;
        for (const r of rules) {
          if (r.regex.test(content)) {
            findings.push({
              file: rel,
              rule: r.id,
              severity: r.severity,
              detail: r.detail
            });
          }
        }
      }
    }
  }

  walk(cwd);

  const highCount = findings.filter((f) => f.severity === "high").length;
  const medCount = findings.filter((f) => f.severity === "medium").length;
  const riskLevel = highCount > 0 ? "high" : (medCount > 0 ? "medium" : "low");

  return {
    check: "config-hygiene-audit",
    mode: "read-only",
    filesScanned,
    findingsCount: findings.length,
    highCount,
    mediumCount,
    findings: findings.slice(0, 30),
    riskLevel
  };
}

function runTlsHttpInspector(urlStr, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(String(urlStr || ""));
    } catch {
      return resolve({
        ok: false,
        error: "INVALID_URL",
        normalized: { check: "tls-http-inspector", mode: "read-only", validUrl: false, riskLevel: "low" }
      });
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return resolve({
        ok: false,
        error: "UNSUPPORTED_PROTOCOL",
        normalized: { check: "tls-http-inspector", mode: "read-only", protocol: parsed.protocol, riskLevel: "medium" }
      });
    }

    const isHttps = parsed.protocol === "https:";
    const client = isHttps ? https : http;
    const req = client.request(
      {
        method: "HEAD",
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname || "/",
        timeout: Math.min(Math.max(Number(timeoutMs) || 8000, 1000), 20000),
        rejectUnauthorized: true
      },
      (res) => {
        const sock = res.socket;
        let certInfo = null;
        if (isHttps && sock && typeof sock.getPeerCertificate === "function") {
          const cert = sock.getPeerCertificate(false);
          if (cert && cert.valid_to) {
            const validToMs = Date.parse(cert.valid_to);
            const daysRemaining = Number.isFinite(validToMs)
              ? Math.floor((validToMs - Date.now()) / (1000 * 60 * 60 * 24))
              : null;
            certInfo = {
              subjectCN: cert.subject?.CN || null,
              issuerO: cert.issuer?.O || null,
              validTo: cert.valid_to,
              daysRemaining
            };
          }
        }

        const headers = res.headers || {};
        const securityHeaders = {
          hsts: Boolean(headers["strict-transport-security"]),
          xContentTypeOptions: String(headers["x-content-type-options"] || "").toLowerCase() === "nosniff",
          xFrameOptions: Boolean(headers["x-frame-options"]),
          csp: Boolean(headers["content-security-policy"])
        };

        const missingHeaders = Object.entries(securityHeaders)
          .filter(([, present]) => !present)
          .map(([k]) => k);

        const riskLevel = !isHttps
          ? "medium"
          : ((certInfo && typeof certInfo.daysRemaining === "number" && certInfo.daysRemaining < 14)
            ? "high"
            : (missingHeaders.length >= 3 ? "medium" : "low"));

        res.resume();
        resolve({
          ok: true,
          normalized: {
            check: "tls-http-inspector",
            mode: "read-only",
            url: parsed.toString(),
            protocol: parsed.protocol,
            statusCode: res.statusCode,
            tlsCertificate: certInfo,
            securityHeaders,
            missingHeaders,
            riskLevel
          }
        });
      }
    );

    req.on("timeout", () => {
      req.destroy(new Error("REQUEST_TIMEOUT"));
    });
    req.on("error", (err) => {
      resolve({
        ok: false,
        error: err.message,
        normalized: {
          check: "tls-http-inspector",
          mode: "read-only",
          url: parsed.toString(),
          error: err.message,
          riskLevel: "medium"
        }
      });
    });
    req.end();
  });
}

async function runSafeLocalCheck({
  realityEngine,
  checkName,
  target = "local-wsl",
  agent = "Local Audit Agent",
  permission = "read-only",
  grantedCapabilities = [],
  cwd = process.cwd(),
  targetUrl = "",
  timeoutMs = 15000,
  signal = null
}) {
  if (!realityEngine || typeof realityEngine.recordExecution !== "function") {
    return { ok: false, error: "Липсва валиден инстанс на RealityEngine." };
  }

  const spec = SAFE_CHECKS[checkName];
  if (!spec) {
    return {
      ok: false,
      error: `Непозволена или непозната проверка '${checkName}'. Разрешени: ${Object.keys(SAFE_CHECKS).join(", ")}`
    };
  }

  if (spec.mode !== "read-only") {
    return { ok: false, error: `Нарушено правило: проверката '${checkName}' не е в режим read-only.` };
  }

  if (!target || !String(target).trim()) {
    return { ok: false, error: "Посочи валиден target (например 'local-wsl' или 'approved-lab')." };
  }

  const commandLabel = spec.kind === "internal"
    ? `internal:${checkName}${targetUrl ? ` (${targetUrl})` : ""}`
    : `${spec.bin} ${spec.args.join(" ")}`;

  const capAllowed = typeof realityEngine.hasCapability === "function"
    ? realityEngine.hasCapability(grantedCapabilities, spec.requiredCapability)
    : Array.isArray(grantedCapabilities) && grantedCapabilities.includes(spec.requiredCapability);

  if (!capAllowed) {
    const deniedRecord = realityEngine.recordExecution({
      command: commandLabel,
      target,
      agent,
      permission: "read-only",
      requiredCapability: spec.requiredCapability,
      grantedCapabilities,
      realOutput: `DENIED: Missing capability '${spec.requiredCapability}' for check '${checkName}'.`,
      evidence: [`policy-check:${checkName}`, `missing-cap:${spec.requiredCapability}`],
      verifiedBySystem: false
    });
    return {
      ok: false,
      blockedByPolicy: true,
      error: `Липсва право '${spec.requiredCapability}' за проверка '${checkName}'.`,
      record: deniedRecord
    };
  }

  const startedAt = Date.now();
  let normalized = null;
  let stdout = "";
  let stderr = "";
  let exitCode = 0;
  let abortedBySignal = false;
  let verifiedBySystem = false;

  if (checkName === "config-hygiene-audit") {
    normalized = runConfigHygieneAudit(cwd);
    stdout = JSON.stringify(normalized);
    verifiedBySystem = true;
  } else if (checkName === "tls-http-inspector") {
    const tlsRes = await runTlsHttpInspector(targetUrl, timeoutMs);
    normalized = tlsRes.normalized;
    stdout = JSON.stringify(normalized);
    stderr = tlsRes.ok ? "" : (tlsRes.error || "");
    verifiedBySystem = Boolean(tlsRes.ok);
  } else {
    let execRes = await execCommandAsync(spec.bin, spec.args, { cwd, timeoutMs, signal });
    if (checkName === "local-listeners" && execRes.error && execRes.error.code === "ENOENT") {
      execRes = await execCommandAsync("netstat", ["-tuln"], { cwd, timeoutMs, signal });
    }
    stdout = execRes.stdout;
    stderr = execRes.stderr;
    exitCode = execRes.exitCode;
    abortedBySignal = execRes.abortedBySignal;
    verifiedBySystem = !execRes.error && !execRes.abortedBySignal && execRes.exitCode === 0;

    if (checkName === "dependency-audit") {
      normalized = normalizeDependencyAudit(cwd, execRes);
      const hasValidAuditJson = Boolean(execRes.stdout && normalized.project.hasPackageJson);
      verifiedBySystem = !execRes.abortedBySignal && (execRes.exitCode === 0 || hasValidAuditJson);
    } else if (checkName === "local-listeners") {
      normalized = parseListenersOutput(execRes.stdout);
    }
  }

  const durationMs = Date.now() - startedAt;
  const combinedOutput = [
    stdout,
    stderr ? `STDERR: ${stderr}` : "",
    normalized ? `NORMALIZED: ${JSON.stringify(normalized)}` : ""
  ]
    .filter(Boolean)
    .join("\n") || `(no output, duration=${durationMs}ms)`;

  const record = realityEngine.recordExecution({
    command: commandLabel,
    target,
    agent,
    permission: "read-only",
    requiredCapability: spec.requiredCapability,
    grantedCapabilities,
    realOutput: combinedOutput,
    evidence: [
      `mode:${spec.mode}`,
      `check:${checkName}`,
      `exit-code:${exitCode}`,
      `duration-ms:${durationMs}`,
      `cwd:${cwd}`
    ],
    verifiedBySystem
  });

  return {
    ok: verifiedBySystem,
    mode: spec.mode,
    aborted: abortedBySignal,
    exitCode,
    durationMs,
    stdout,
    stderr,
    normalized,
    record
  };
}

module.exports = {
  SAFE_CHECKS,
  normalizeDependencyAudit,
  parseListenersOutput,
  runConfigHygieneAudit,
  runTlsHttpInspector,
  runSafeLocalCheck
};
