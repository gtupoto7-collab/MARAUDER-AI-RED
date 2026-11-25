"use strict";

const LANGUAGE_RULES = {
  javascript: {
    label: "JavaScript / Node.js",
    patterns: [
      { id: "JS-EVAL", severity: "high", re: /\b(eval|new Function)\s*\(/, note: "Dynamic code execution construct detected; review input trust boundaries." },
      { id: "JS-CMD-SHELL", severity: "high", re: /\b(exec|execSync|spawn)\s*\(/, note: "OS command execution call; verify argument allowlisting and avoid shell interpolation." },
      { id: "JS-HARDCODED-SECRET", severity: "medium", re: /(api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{6,}["']/i, note: "Potential hardcoded credential/secret literal; move to environment or secret store." },
      { id: "JS-PROTOTYPE-POLLUTION", severity: "medium", re: /__proto__|Object\.assign\s*\(\s*\{\s*\}/, note: "Check object key validation to prevent prototype pollution." }
    ]
  },
  typescript: {
    label: "TypeScript",
    inherits: "javascript",
    patterns: [
      { id: "TS-ANY-CAST", severity: "low", re: /\bas\s+any\b|:\s*any\b/, note: "Explicit any usage weakens compile-time type safety on external inputs." }
    ]
  },
  python: {
    label: "Python",
    patterns: [
      { id: "PY-EVAL-EXEC", severity: "high", re: /\b(eval|exec)\s*\(/, note: "Dynamic evaluation in Python; avoid untrusted input." },
      { id: "PY-SUBPROCESS-SHELL", severity: "high", re: /subprocess\.[a-zA-Z0-9_]+\([^\n]*shell\s*=\s*True/, note: "subprocess with shell=True increases command injection risk; prefer argument lists." },
      { id: "PY-PICKLE", severity: "high", re: /\bpickle\.(loads|load)\s*\(/, note: "Deserializing untrusted pickle streams can execute arbitrary code." },
      { id: "PY-HARDCODED-SECRET", severity: "medium", re: /(password|secret|api_key|token)\s*=\s*["'][^"']{6,}["']/i, note: "Potential hardcoded secret; use environment variables or secret manager." }
    ]
  },
  bash: {
    label: "Bash / Shell",
    patterns: [
      { id: "SH-CURL-PIPE-SH", severity: "high", re: /(curl|wget)[^\n|]*\|\s*(sh|bash)\b/, note: "Piping remote script directly into a shell lacks integrity verification before execution." },
      { id: "SH-EVAL", severity: "high", re: /\beval\s+/, note: "Shell eval can execute injected strings; validate and quote variables." },
      { id: "SH-UNQUOTED-VAR", severity: "low", re: /\$[A-Za-z_][A-Za-z0-9_]*(?![A-Za-z0-9_"])/, note: "Check variable quoting around shell variables to avoid word splitting and globbing." }
    ]
  },
  c: {
    label: "C / C++",
    patterns: [
      { id: "C-UNBOUNDED-COPY", severity: "high", re: /\b(strcpy|strcat|sprintf|gets)\s*\(/, note: "Unbounded C string or buffer function detected; prefer bounds-checked alternatives and length checks." },
      { id: "C-FORMAT-STR", severity: "medium", re: /\bprintf\s*\(\s*[A-Za-z_][A-Za-z0-9_]*\s*\)/, note: "Non-constant format string argument; ensure format specifiers are fixed." }
    ]
  },
  csharp: {
    label: "C# / .NET",
    patterns: [
      { id: "CS-PROCESS-START", severity: "high", re: /Process\.Start\s*\(/, note: "Process execution detected; validate executable path and arguments." },
      { id: "CS-SQL-CONCAT", severity: "high", re: /(SqlCommand|ExecuteSqlRaw)[^\n;]*\+/, note: "String concatenation in SQL command detected; use parameterized queries." }
    ]
  },
  sql: {
    label: "SQL",
    patterns: [
      { id: "SQL-DYNAMIC-EXEC", severity: "medium", re: /\b(EXEC|EXECUTE|sp_executesql)\b/i, note: "Dynamic SQL execution; verify parameterization and least privilege." }
    ]
  },
  php: {
    label: "PHP",
    patterns: [
      { id: "PHP-EVAL-EXEC", severity: "high", re: /\b(eval|shell_exec|system|passthru)\s*\(/i, note: "Dynamic or OS execution function in PHP; enforce strict allowlisting and input validation." },
      { id: "PHP-INCLUDE-VAR", severity: "medium", re: /\b(include|require)(_once)?\s*\(\s*\$_(GET|POST|REQUEST)/i, note: "Dynamic file inclusion from request input; restrict paths to a safe allowlist." }
    ]
  },
  go: {
    label: "Go",
    patterns: [
      { id: "GO-EXEC-CMD", severity: "high", re: /\bexec\.Command\s*\(/, note: "Command execution in Go; ensure command and arguments come from trusted sources." },
      { id: "GO-TLS-SKIP-VERIFY", severity: "high", re: /InsecureSkipVerify\s*:\s*true/, note: "TLS certificate verification is disabled; enable verification in production." }
    ]
  }
};

function detectLanguage(code = "", hint = "") {
  const cleanHint = String(hint || "").toLowerCase().trim();
  const aliasMap = {
    js: "javascript",
    javascript: "javascript",
    node: "javascript",
    ts: "typescript",
    typescript: "typescript",
    py: "python",
    python: "python",
    sh: "bash",
    bash: "bash",
    shell: "bash",
    c: "c",
    cpp: "c",
    "c++": "c",
    cs: "csharp",
    csharp: "csharp",
    dotnet: "csharp",
    sql: "sql",
    php: "php",
    go: "go",
    golang: "go"
  };
  if (aliasMap[cleanHint]) return aliasMap[cleanHint];

  const sample = String(code || "");
  if (/^\s*#!.*\b(bash|sh)\b/m.test(sample)) return "bash";
  if (/\bdef\s+[a-zA-Z_][a-zA-Z0-9_]*\s*\(|\bimport\s+subprocess\b/.test(sample)) return "python";
  if (/\b(interface|type)\s+[A-Z][A-Za-z0-9_]*\s*=|\b:\s*(string|number|boolean)\b/.test(sample)) return "typescript";
  if (/\bpackage\s+main\b|\bfunc\s+[A-Za-z_][A-Za-z0-9_]*\s*\(/.test(sample)) return "go";
  if (/\bnamespace\s+[A-Za-z0-9_.]+|\busing\s+System\b/.test(sample)) return "csharp";
  if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE\s+TABLE)\b/i.test(sample)) return "sql";
  if (/<\?php|\$[a-zA-Z_][a-zA-Z0-9_]*/.test(sample)) return "php";
  if (/#include\s*<|\bint\s+main\s*\(/.test(sample)) return "c";
  return "javascript";
}

function collectStaticFindings(code, language) {
  const ruleSet = LANGUAGE_RULES[language] || LANGUAGE_RULES.javascript;
  const combined = [];

  if (ruleSet.inherits && LANGUAGE_RULES[ruleSet.inherits]) {
    combined.push(...LANGUAGE_RULES[ruleSet.inherits].patterns);
  }
  combined.push(...ruleSet.patterns);

  const lines = String(code || "").split(/\r?\n/);
  const findings = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    for (const pat of combined) {
      if (pat.re.test(line)) {
        findings.push({
          ruleId: pat.id,
          severity: pat.severity,
          line: idx + 1,
          note: pat.note
        });
      }
    }
  }

  return {
    languageLabel: ruleSet.label,
    findings
  };
}

class CodeDefenseAnalyzer {
  constructor(options = {}) {
    this.aiCore = options.aiCore || null;
    this.memoryFabric = options.memoryFabric || null;
    this.defaultModel = options.model || process.env.MARAUDER_CODE_AUDIT_MODEL || "marauder-coder:latest";
    this.timeoutMs = Number(options.timeoutMs || process.env.MARAUDER_CODE_AUDIT_TIMEOUT_MS || 20000);
  }

  async analyzeCode({ code, language = "", fileName = "", model = null, timeoutMs = null } = {}) {
    if (typeof code !== "string" || !code.trim()) {
      throw new Error("CODE_CONTENT_REQUIRED");
    }

    const detectedLang = detectLanguage(code, language || fileName.split(".").pop() || "");
    const staticScan = collectStaticFindings(code, detectedLang);

    const prompt = [
      `You are a defensive code security auditor in MARAUDER (${staticScan.languageLabel}).`,
      "Focus strictly on defensive hardening, input validation, least privilege, secret hygiene, and auditability.",
      "Do not generate exploit payloads or offensive instructions.",
      `File: ${fileName || "snippet"} | Language: ${detectedLang}`,
      `Static findings: ${JSON.stringify(staticScan.findings)}`,
      "Code to audit:",
      "```",
      code.slice(0, 6000),
      "```",
      "Return a concise defensive security review with concrete remediation steps."
    ].join("\n");

    let gatewayRes = null;
    if (this.aiCore && typeof this.aiCore.reasonWithGateway === "function") {
      gatewayRes = await this.aiCore.reasonWithGateway({
        task: "code-audit",
        model: model || this.defaultModel,
        timeoutMs: timeoutMs || this.timeoutMs,
        prompt
      });
    }

    const usedModel = Boolean(gatewayRes && gatewayRes.usedModel === true);
    const executionMode = usedModel ? "LIVE_MODEL" : "FALLBACK_NO_MODEL";

    const result = {
      ok: true,
      language: detectedLang,
      languageLabel: staticScan.languageLabel,
      fileName: fileName || null,
      staticFindingsCount: staticScan.findings.length,
      staticFindings: staticScan.findings,
      modelTelemetry: {
        usedModel,
        executionMode,
        provider: gatewayRes && gatewayRes.provider ? gatewayRes.provider : "fallback",
        model: gatewayRes && gatewayRes.model ? gatewayRes.model : (model || this.defaultModel),
        latencyMs: gatewayRes && typeof gatewayRes.latencyMs === "number" ? gatewayRes.latencyMs : 0,
        fallbackReason: usedModel ? null : ((gatewayRes && gatewayRes.fallbackReason) || "NO_LIVE_MODEL")
      },
      analysisSummary:
        gatewayRes && gatewayRes.output
          ? String(gatewayRes.output).trim()
          : staticScan.findings.length > 0
            ? staticScan.findings.map((f) => `[${f.severity.toUpperCase()} L${f.line} ${f.ruleId}] ${f.note}`).join(" | ")
            : `No static high-risk patterns detected in ${staticScan.languageLabel} snippet; verify business logic and input bounds.`
    };

    if (this.memoryFabric && typeof this.memoryFabric.recordAudit === "function") {
      this.memoryFabric.recordAudit(
        "CODE_DEFENSE_ANALYZED",
        {
          language: detectedLang,
          fileName: result.fileName,
          staticFindingsCount: result.staticFindingsCount,
          executionMode,
          usedModel,
          model: result.modelTelemetry.model
        },
        "code-defense-analyzer"
      );
    }

    return result;
  }
}

module.exports = {
  LANGUAGE_RULES,
  detectLanguage,
  collectStaticFindings,
  CodeDefenseAnalyzer
};
