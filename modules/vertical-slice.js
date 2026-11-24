const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { Mission, BlackBox, Parliament, EventPipeline, sha256 } = require("./black-box-parliament");

function runCmd(bin, args = [], cwd = process.cwd(), timeoutMs = 10000) {
  return new Promise((resolve) => {
    const started = Date.now();
    execFile(bin, args, { cwd, timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        code: err ? err.code ?? 1 : 0,
        durationMs: Date.now() - started,
        stdout: (stdout || "").trim(),
        stderr: (stderr || "").trim()
      });
    });
  });
}

class ReadOnlyVerticalSlice {
  constructor(projectDir = process.cwd()) {
    this.projectDir = projectDir;
    this.parliament = new Parliament();
    this.pipeline = new EventPipeline();
    fs.mkdirSync(path.join(this.projectDir, "data", "reports"), { recursive: true });
  }

  _assertReadOnly(action) {
    if (!action || action.mode !== "read-only") {
      throw new Error("VERTICAL_SLICE_REQUIRES_READ_ONLY_MODE");
    }
  }

  async runDependencyAudit(targetDir = this.projectDir) {
    const action = { id: "dependency-audit", mode: "read-only", target: targetDir };
    this._assertReadOnly(action);

    const pkgPath = path.join(targetDir, "package.json");
    const lockPath = path.join(targetDir, "package-lock.json");
    const hasPkg = fs.existsSync(pkgPath);
    const hasLock = fs.existsSync(lockPath);

    let pkgJson = null;
    let lockJson = null;
    try {
      if (hasPkg) pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    } catch (_) {}
    try {
      if (hasLock) lockJson = JSON.parse(fs.readFileSync(lockPath, "utf8"));
    } catch (_) {}

    const lockMismatch = Boolean(
      pkgJson &&
      lockJson &&
      pkgJson.dependencies &&
      lockJson.packages &&
      lockJson.packages[""] &&
      lockJson.packages[""].dependencies &&
      JSON.stringify(Object.keys(pkgJson.dependencies).sort()) !==
        JSON.stringify(Object.keys(lockJson.packages[""].dependencies).sort())
    );

    const auditExec = hasPkg
      ? await runCmd("npm", ["audit", "--json"], targetDir, 15000)
      : { ok: false, code: 1, durationMs: 0, stdout: "", stderr: "package.json not found" };

    const outdatedExec = hasPkg
      ? await runCmd("npm", ["outdated", "--json"], targetDir, 15000)
      : { ok: false, code: 1, durationMs: 0, stdout: "", stderr: "package.json not found" };

    let auditSummary = { totalVulns: 0, highOrCritical: 0, rawParsed: false };
    if (auditExec.stdout) {
      try {
        const parsed = JSON.parse(auditExec.stdout);
        const meta = parsed.metadata && parsed.metadata.vulnerabilities ? parsed.metadata.vulnerabilities : {};
        const totalVulns = Object.values(meta).reduce((a, b) => a + (Number(b) || 0), 0);
        const highOrCritical = (Number(meta.high) || 0) + (Number(meta.critical) || 0);
        auditSummary = { totalVulns, highOrCritical, metadata: meta, rawParsed: true };
      } catch (_) {}
    }

    let outdatedPackages = [];
    if (outdatedExec.stdout) {
      try {
        const outObj = JSON.parse(outdatedExec.stdout);
        outdatedPackages = Object.keys(outObj || {});
      } catch (_) {}
    }

    const suspiciousDeps = Object.keys((pkgJson && pkgJson.dependencies) || {}).filter((name) =>
      /(eval|shell|exec|miner|xmrig|stealer|backdoor|pwn)/i.test(name)
    );

    const rawOutput = {
      hasPkg,
      hasLock,
      lockMismatch,
      auditSummary,
      outdatedCount: outdatedPackages.length,
      outdatedPackages: outdatedPackages.slice(0, 25),
      suspiciousDeps,
      durationMs: auditExec.durationMs
    };

    const normalizedEvents = this.pipeline.normalize(
      this.pipeline.filter([
        {
          source: "dependency-audit",
          asset: targetDir,
          severity: auditSummary.highOrCritical > 0 || suspiciousDeps.length > 0 ? "HIGH" : auditSummary.totalVulns > 0 ? "MEDIUM" : "LOW",
          category: "dependencies",
          message: `vulns=${auditSummary.totalVulns}, highOrCritical=${auditSummary.highOrCritical}, lockMismatch=${lockMismatch}, outdated=${outdatedPackages.length}, suspicious=${suspiciousDeps.length}`
        }
      ])
    );

    return {
      tool: "dependency-audit",
      mode: action.mode,
      target: targetDir,
      rawOutput,
      normalizedEvents,
      evidence: {
        verified: hasPkg && (auditSummary.rawParsed || auditExec.code === 0 || auditExec.code === 1),
        source: "npm audit --json + package/lock inspection",
        evidenceHash: sha256(rawOutput),
        observedAt: new Date().toISOString()
      }
    };
  }

  async runLocalListeners() {
    const action = { id: "local-listeners", mode: "read-only", target: "localhost" };
    this._assertReadOnly(action);

    const cmdRes =
      process.platform === "win32"
        ? await runCmd("netstat", ["-ano", "-p", "TCP"], this.projectDir, 8000)
        : await runCmd("ss", ["-tlpn"], this.projectDir, 8000);

    const listeners = [];
    const lines = (cmdRes.stdout || "").split("\n").map((l) => l.trim()).filter(Boolean);

    for (const line of lines) {
      if (process.platform === "win32" && /LISTENING/i.test(line)) {
        const parts = line.split(/\s+/);
        const localAddr = parts[1] || "";
        const pid = parts[4] || "";
        const portMatch = localAddr.match(/:(\d+)$/);
        const port = portMatch ? Number(portMatch[1]) : null;
        const exposedAll = localAddr.startsWith("0.0.0.0:") || localAddr.startsWith("[::]:");
        const service =
          port === 3000 ? "node-web" : port === 5432 ? "postgresql" : port === 11434 ? "ollama" : port === 1488 ? "custom-port-1488" : "unknown";
        const risk = exposedAll ? "MEDIUM" : "LOW";
        listeners.push({
          bind: localAddr,
          port,
          pid,
          process: `pid:${pid || "n/a"}`,
          service,
          configuration: exposedAll ? "bound-all-interfaces" : "loopback-or-scoped",
          risk
        });
      } else if (process.platform !== "win32" && /LISTEN/i.test(line)) {
        const parts = line.split(/\s+/);
        const localAddr = parts[3] || "";
        const portMatch = localAddr.match(/:(\d+)$/);
        const port = portMatch ? Number(portMatch[1]) : null;
        const procMatch = line.match(/users:\(\("([^"]+)",pid=(\d+)/);
        const exposedAll = localAddr.startsWith("0.0.0.0:") || localAddr.startsWith("*:") || localAddr.startsWith("[::]:");
        const service =
          port === 3000 ? "node-web" : port === 5432 ? "postgresql" : port === 11434 ? "ollama" : port === 1488 ? "custom-port-1488" : "unknown";
        listeners.push({
          bind: localAddr,
          port,
          pid: procMatch ? procMatch[2] : null,
          process: procMatch ? procMatch[1] : "unknown",
          service,
          configuration: exposedAll ? "bound-all-interfaces" : "loopback-or-scoped",
          risk: exposedAll ? "MEDIUM" : "LOW"
        });
      }
    }

    const rawOutput = {
      platform: process.platform,
      count: listeners.length,
      listeners: listeners.slice(0, 50),
      durationMs: cmdRes.durationMs
    };

    const exposedCount = listeners.filter((x) => x.configuration === "bound-all-interfaces").length;
    const normalizedEvents = this.pipeline.normalize(
      this.pipeline.filter([
        {
          source: "local-listeners",
          asset: "localhost",
          severity: exposedCount > 0 ? "MEDIUM" : "LOW",
          category: "network-sockets",
          message: `listening=${listeners.length}, boundAllInterfaces=${exposedCount}`
        }
      ])
    );

    return {
      tool: "local-listeners",
      mode: action.mode,
      target: "localhost",
      rawOutput,
      normalizedEvents,
      evidence: {
        verified: cmdRes.ok || listeners.length > 0,
        source: process.platform === "win32" ? "netstat -ano -p TCP" : "ss -tlpn",
        evidenceHash: sha256(rawOutput),
        observedAt: new Date().toISOString()
      }
    };
  }

  async executeSlice({ targetScope = "verified-local-lab", objective = "Read-only dependency and local listener baseline" } = {}) {
    const mission = new Mission({ targetScope, objective });
    const blackBox = new BlackBox(mission);

    const depRes = await this.runDependencyAudit(this.projectDir);
    const sockRes = await this.runLocalListeners();

    const scoredEvents = this.pipeline.score(
      this.pipeline.correlate(
        this.pipeline.deduplicate([...depRes.normalizedEvents, ...sockRes.normalizedEvents])
      )
    );
    this.pipeline.routeTiers(scoredEvents);

    for (const ev of scoredEvents) {
      blackBox.appendEvent(ev);
    }

    blackBox.appendEvidence(depRes.evidence);
    blackBox.appendEvidence(sockRes.evidence);

    const highestScore = scoredEvents[0] ? scoredEvents[0].riskScore : 15;
    const severity = highestScore >= 75 ? "HIGH" : highestScore >= 45 ? "MEDIUM" : "LOW";
    const risk = this.parliament.evaluateRisk({ severity, mutating: false });

    const proposal = this.parliament.propose({
      action: "read-only-baseline-report",
      targetScope,
      agentId: "MRD-SLICE-RO",
      capability: "filesystem.read"
    });

    const policy = this.parliament.evaluatePolicy(proposal, risk);
    const quorumResult = this.parliament.quorum([
      { role: "Evidence Agent", approve: depRes.evidence.verified && sockRes.evidence.verified },
      { role: "Policy Verifier", approve: policy.allowed }
    ]);

    const decision = this.parliament.authorize({
      proposal,
      evidence: depRes.evidence,
      risk,
      policy,
      quorumResult,
      blackBox
    });

    const finalized = blackBox.finalizeMission(decision.authorized ? "COMPLETED" : "REJECTED");

    const report = {
      missionId: mission.missionId,
      targetScope,
      mode: "read-only",
      riskAssessment: risk,
      parliamentDecision: decision,
      dependencyAudit: depRes.rawOutput,
      localListeners: sockRes.rawOutput,
      scoredEvents,
      blackBoxDigest: finalized.missionDigest,
      integrity: finalized.integrity
    };

    const reportPath = path.join(this.projectDir, "data", "reports", `${mission.missionId}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    return { ok: true, reportPath, report };
  }
}

module.exports = ReadOnlyVerticalSlice;
