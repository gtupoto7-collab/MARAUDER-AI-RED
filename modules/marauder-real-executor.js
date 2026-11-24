const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const TOOL_CATALOG = Object.freeze([
  {
    id: "semgrep",
    binary: "semgrep",
    category: "code.audit",
    allowedActions: ["scan-project", "version-check"],
    allowedArgPrefixes: ["--version", "--config", "auto", "--json", "--quiet"],
    defaultArgs: ["--version"],
    requiresApproval: false,
    verifyOutput: (code, stdout) => code === 0 && /semgrep|\d+\.\d+\.\d+|scannedFiles/i.test(stdout)
  },
  {
    id: "nmap",
    binary: "nmap",
    category: "network.observe",
    allowedActions: ["scan-local", "version-check"],
    allowedArgPrefixes: ["--version", "-sn", "-sV", "-p", "127.0.0.1", "localhost"],
    defaultArgs: ["--version"],
    requiresApproval: false,
    verifyOutput: (code, stdout) => code === 0 && /nmap|starting nmap|nmap scan report/i.test(stdout)
  },
  {
    id: "trivy",
    binary: "trivy",
    category: "dependency.audit",
    allowedActions: ["fs-scan", "version-check"],
    allowedArgPrefixes: ["--version", "fs", "--scanners", "vuln,secret", "--quiet"],
    defaultArgs: ["--version"],
    requiresApproval: false,
    verifyOutput: (code, stdout) => code === 0 && /trivy|version/i.test(stdout)
  },
  {
    id: "gitleaks",
    binary: "gitleaks",
    category: "secrets.scan",
    allowedActions: ["detect", "version-check"],
    allowedArgPrefixes: ["version", "detect", "--source", "--no-git", "--exit-code"],
    defaultArgs: ["version"],
    requiresApproval: false,
    verifyOutput: (code, stdout) => code === 0 && /\d+\.\d+\.\d+|gitleaks/i.test(stdout)
  },
  {
    id: "yara",
    binary: "yara",
    category: "malware.scan",
    allowedActions: ["scan-file", "version-check"],
    allowedArgPrefixes: ["--version", "-r"],
    defaultArgs: ["--version"],
    requiresApproval: false,
    verifyOutput: (code, stdout) => code === 0 && /\d+\.\d+\.\d+|yara/i.test(stdout)
  },
  {
    id: "nuclei",
    binary: "nuclei",
    category: "vuln.scan",
    allowedActions: ["template-scan", "version-check"],
    allowedArgPrefixes: ["-version", "-u", "-t", "-silent"],
    defaultArgs: ["-version"],
    requiresApproval: true,
    verifyOutput: (code, stdout, stderr) => code === 0 && /nuclei|projectdiscovery/i.test(`${stdout}\n${stderr}`)
  },
  {
    id: "ollama",
    binary: "ollama",
    category: "llm.local",
    allowedActions: ["list-models", "version-check"],
    allowedArgPrefixes: ["--version", "list", "ps"],
    defaultArgs: ["--version"],
    requiresApproval: false,
    verifyOutput: (code, stdout) => code === 0 && /ollama|name|id/i.test(stdout)
  }
]);

const SCOPE_VALIDATORS = Object.freeze({
  "approved-project": (target, projectDir) => {
    const t = String(target || "").trim();
    if (!t || t === "." || t === "./") return true;
    const base = path.resolve(projectDir);
    const resolved = path.resolve(projectDir, t);
    return resolved === base || resolved.startsWith(base + path.sep);
  },
  "verified-local-lab": (target) => {
    const t = String(target || "").trim().toLowerCase();
    return (
      t === "localhost" ||
      t === "127.0.0.1" ||
      t === "::1" ||
      t.startsWith("127.0.0.1:") ||
      t.startsWith("localhost:") ||
      t.startsWith("http://127.0.0.1") ||
      t.startsWith("http://localhost") ||
      t.startsWith("lab://")
    );
  },
  localhost: (target) => {
    const t = String(target || "").trim().toLowerCase();
    return (
      t === "localhost" ||
      t === "127.0.0.1" ||
      t === "::1" ||
      t.startsWith("127.0.0.1:") ||
      t.startsWith("localhost:") ||
      t.startsWith("http://127.0.0.1") ||
      t.startsWith("http://localhost")
    );
  }
});

function sha256Text(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function sha256File(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const st = fs.statSync(filePath);
    if (!st.isFile()) return null;
    return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
  } catch {
    return null;
  }
}

function resolveExecutable(binary) {
  const lookupCmd = process.platform === "win32" ? "where" : "which";
  const res = spawnSync(lookupCmd, [binary], { encoding: "utf8", shell: false, timeout: 4000 });
  if (res.status !== 0 || !res.stdout) return null;
  const firstLine = res.stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find(Boolean);
  if (!firstLine) return null;
  try {
    const real = fs.realpathSync(firstLine);
    const st = fs.statSync(real);
    if (!st.isFile()) return null;
    return real;
  } catch {
    return null;
  }
}

class MarauderRealExecutor {
  constructor(projectDir = process.cwd()) {
    this.projectDir = projectDir;
    this.stateDir = path.join(projectDir, "data", "real-execution");
    this.chainPath = path.join(this.stateDir, "blackbox-chain.jsonl");
    this.killSwitchPath = path.join(this.stateDir, "kill-switch.json");
    fs.mkdirSync(this.stateDir, { recursive: true });
    if (!fs.existsSync(this.killSwitchPath)) {
      fs.writeFileSync(this.killSwitchPath, JSON.stringify({ armed: false, reason: "initialized" }, null, 2));
    }
  }

  setKillSwitch(armed, reason = "manual-control") {
    const payload = {
      armed: Boolean(armed),
      reason: String(reason || ""),
      updatedAt: new Date().toISOString()
    };
    const tmpPath = `${this.killSwitchPath}.tmp.${process.pid}`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2));
    fs.renameSync(tmpPath, this.killSwitchPath);
    return payload;
  }

  getKillSwitchState() {
    if (!fs.existsSync(this.killSwitchPath)) {
      return { armed: true, failClosed: true, reason: "KILL_SWITCH_FILE_MISSING" };
    }
    try {
      const data = JSON.parse(fs.readFileSync(this.killSwitchPath, "utf8"));
      if (typeof data.armed !== "boolean") {
        return { armed: true, failClosed: true, reason: "KILL_SWITCH_INVALID_SCHEMA" };
      }
      return { armed: data.armed, failClosed: false, reason: data.reason || null };
    } catch {
      return { armed: true, failClosed: true, reason: "KILL_SWITCH_CORRUPT_JSON" };
    }
  }

  validateTargetForScope(scope, target) {
    const fn = SCOPE_VALIDATORS[scope];
    if (!fn) {
      return { valid: false, reason: `SCOPE_NOT_ALLOWED:${scope}` };
    }
    if (!fn(target, this.projectDir)) {
      return { valid: false, reason: `TARGET_OUT_OF_SCOPE:${scope}:${target}` };
    }
    return { valid: true };
  }

  validateArgs(toolMeta, rawArgs) {
    if (rawArgs === null || rawArgs === undefined) {
      return { valid: true, args: [...toolMeta.defaultArgs] };
    }
    if (!Array.isArray(rawArgs) || rawArgs.length === 0 || rawArgs.length > 12) {
      return { valid: false, reason: "INVALID_ARGS_LIST" };
    }
    const cleanArgs = rawArgs.map((a) => String(a));
    for (const arg of cleanArgs) {
      if (/[\r\n\0]/.test(arg)) {
        return { valid: false, reason: "CONTROL_CHAR_IN_ARGS" };
      }
      const allowed = toolMeta.allowedArgPrefixes.some(
        (prefix) => arg === prefix || arg.startsWith(prefix)
      );
      if (!allowed) {
        return { valid: false, reason: `ARG_NOT_ALLOWED:${arg}` };
      }
    }
    return { valid: true, args: cleanArgs };
  }

  inspectTools() {
    return TOOL_CATALOG.map((tool) => {
      const execPath = resolveExecutable(tool.binary);
      const installed = Boolean(execPath);
      const binaryHash = installed ? sha256File(execPath) : null;
      let version = null;

      if (installed) {
        const verRes = spawnSync(execPath, tool.defaultArgs, {
          encoding: "utf8",
          shell: false,
          timeout: 5000
        });
        const combined = `${verRes.stdout || ""} ${verRes.stderr || ""}`.trim();
        version = combined ? combined.split(/\r?\n/)[0].slice(0, 120) : "unknown";
      }

      return {
        id: tool.id,
        binary: tool.binary,
        category: tool.category,
        allowedActions: tool.allowedActions,
        requiresApproval: tool.requiresApproval,
        status: installed ? "INSTALLED" : "MISSING",
        health: installed ? "HEALTHY" : "UNAVAILABLE",
        executablePath: execPath,
        version,
        sha256: binaryHash
      };
    });
  }

  _readChain() {
    if (!fs.existsSync(this.chainPath)) return [];
    const lines = fs
      .readFileSync(this.chainPath, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    return lines.map((line) => JSON.parse(line));
  }

  verifyChain() {
    if (!fs.existsSync(this.chainPath)) {
      return { valid: true, entries: 0, headHash: "GENESIS", reason: "EMPTY_CHAIN" };
    }
    let entries;
    try {
      entries = this._readChain();
    } catch {
      return { valid: false, entries: 0, reason: "CORRUPT_JSONL" };
    }

    let expectedSeq = 1;
    let expectedPrev = "GENESIS";

    for (let i = 0; i < entries.length; i++) {
      const item = entries[i];
      const { hash, ...body } = item;
      if (body.seq !== expectedSeq) {
        return { valid: false, index: i, reason: "SEQ_MISMATCH", expectedSeq, actualSeq: body.seq };
      }
      if (body.prevHash !== expectedPrev) {
        return { valid: false, index: i, reason: "BROKEN_PREV_HASH", expectedPrev, actualPrev: body.prevHash };
      }
      const recomputed = sha256Text(JSON.stringify(body));
      if (recomputed !== hash) {
        return { valid: false, index: i, reason: "HASH_MISMATCH", executionId: body.executionId || i };
      }
      expectedSeq += 1;
      expectedPrev = hash;
    }

    return { valid: true, entries: entries.length, headHash: expectedPrev };
  }

  appendBlackBox(record) {
    const chainCheck = this.verifyChain();
    if (!chainCheck.valid) {
      throw new Error(`BLACKBOX_CHAIN_TAMPERED:${chainCheck.reason}`);
    }
    const seq = chainCheck.entries + 1;
    const prevHash = chainCheck.headHash || "GENESIS";
    const body = {
      seq,
      prevHash,
      ...record
    };
    const hash = sha256Text(JSON.stringify(body));
    const entry = { ...body, hash };
    fs.appendFileSync(this.chainPath, `${JSON.stringify(entry)}\n`);
    return entry;
  }

  runTool({
    agentId = "ROOT-AGT-001",
    toolId,
    action = "version-check",
    args = null,
    scope = "approved-project",
    target = ".",
    approved = false,
    timeoutMs = 15000,
    allowBuiltInFallback = false
  } = {}) {
    const ks = this.getKillSwitchState();
    if (ks.armed) {
      return {
        ok: false,
        verified: false,
        status: "KILLED_BY_SWITCH",
        reason: ks.reason
      };
    }

    const scopeCheck = this.validateTargetForScope(scope, target);
    if (!scopeCheck.valid) {
      return {
        ok: false,
        verified: false,
        status: "SCOPE_REJECTED",
        reason: scopeCheck.reason
      };
    }

    const toolMeta = TOOL_CATALOG.find((t) => t.id === toolId);
    if (!toolMeta) {
      return {
        ok: false,
        verified: false,
        status: "UNKNOWN_TOOL",
        reason: `UNKNOWN_TOOL:${toolId}`
      };
    }

    if (!toolMeta.allowedActions.includes(action)) {
      return {
        ok: false,
        verified: false,
        status: "ACTION_NOT_ALLOWED",
        reason: `ACTION_NOT_ALLOWED:${action}`
      };
    }

    const argCheck = this.validateArgs(toolMeta, args);
    if (!argCheck.valid) {
      return {
        ok: false,
        verified: false,
        status: "ARGS_REJECTED",
        reason: argCheck.reason
      };
    }

    if (toolMeta.requiresApproval && !approved) {
      return {
        ok: false,
        verified: false,
        status: "APPROVAL_REQUIRED",
        toolId,
        action,
        scope,
        target
      };
    }

    if (toolMeta.requiresApproval && approved) {
      const recheck = this.validateTargetForScope(scope, target);
      if (!recheck.valid) {
        return {
          ok: false,
          verified: false,
          status: "APPROVAL_RECHECK_FAILED",
          reason: recheck.reason
        };
      }
    }

    const execPath = resolveExecutable(toolMeta.binary);
    const binarySha256 = execPath ? sha256File(execPath) : null;
    const executionId = `EXEC-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const startedAt = new Date().toISOString();
    const t0 = Date.now();

    let exitCode = 127;
    let stdout = "";
    let stderr = "";
    let verified = false;
    let mode = "BINARY";
    let spawnError = null;

    if (execPath && binarySha256) {
      const proc = spawnSync(execPath, argCheck.args, {
        cwd: this.projectDir,
        encoding: "utf8",
        shell: false,
        timeout: Math.min(Math.max(500, timeoutMs), 20000)
      });
      spawnError = proc.error ? proc.error.message : null;
      exitCode = typeof proc.status === "number" ? proc.status : 1;
      stdout = String(proc.stdout || "").trim();
      stderr = String(proc.stderr || "").trim();
      verified = !spawnError && toolMeta.verifyOutput(exitCode, stdout, stderr);
    } else if (allowBuiltInFallback && toolMeta.id === "semgrep") {
      mode = "NODE_SAFE_AUDIT_FALLBACK";
      const pkgPath = path.join(this.projectDir, "package.json");
      const exists = fs.existsSync(pkgPath);
      const modCount = fs.existsSync(path.join(this.projectDir, "modules"))
        ? fs.readdirSync(path.join(this.projectDir, "modules")).length
        : 0;
      exitCode = exists ? 0 : 1;
      stdout = JSON.stringify({ checkedTarget: target, packageJsonExists: exists, modulesCount: modCount });
      stderr = "";
      verified = exists && toolMeta.verifyOutput(exitCode, stdout, stderr);
    } else {
      exitCode = 127;
      stderr = `BINARY_MISSING:${toolMeta.binary}`;
      verified = false;
    }

    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - t0;

    const evidence = {
      executionId,
      agentId,
      toolId: toolMeta.id,
      binaryPath: execPath || null,
      binarySha256,
      action,
      scope,
      target: String(target),
      approved: Boolean(approved),
      args: argCheck.args,
      mode,
      startedAt,
      finishedAt,
      durationMs,
      exitCode,
      spawnError,
      stdout: stdout.slice(0, 2000),
      stderr: stderr.slice(0, 1000),
      verified
    };

    const logged = this.appendBlackBox(evidence);

    return {
      ok: verified,
      verified,
      status: verified ? "VERIFIED_EXECUTED" : "UNVERIFIED_OR_FAILED",
      evidence: logged
    };
  }
}

module.exports = { MarauderRealExecutor, TOOL_CATALOG, SCOPE_VALIDATORS };
