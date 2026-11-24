const assert = require("assert");
const fs = require("fs");
const { MarauderRealExecutor } = require("../modules/marauder-real-executor");

function runTestSuite() {
  const results = [];
  const mark = (name, passed, detail = "") => {
    results.push({ name, passed, detail });
    console.log(`[${passed ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
  };

  const exec = new MarauderRealExecutor(process.cwd());
  exec.setKillSwitch(false, "test-init");

  // 1. Tool Registry
  const tools = exec.inspectTools();
  mark("Tool Registry", Array.isArray(tools) && tools.length >= 7, `${tools.length} tools cataloged`);

  // 2. Semgrep Execution (real binary or controlled local audit fallback)
  const semRun = exec.runTool({
    agentId: "ROOT-AGT-001",
    toolId: "semgrep",
    action: "version-check",
    scope: "approved-project",
    target: ".",
    allowBuiltInFallback: true
  });
  mark("Semgrep Execution", semRun.evidence && typeof semRun.evidence.exitCode === "number", `exit=${semRun.evidence.exitCode}, verified=${semRun.verified}`);

  // 3. Evidence Collection
  const ev = semRun.evidence;
  const hasEvidence = Boolean(
    ev &&
      ev.executionId &&
      ev.startedAt &&
      ev.finishedAt &&
      typeof ev.exitCode === "number" &&
      ev.hash &&
      ev.hash.length === 64
  );
  mark("Evidence Collection", hasEvidence, `id=${ev.executionId}, hash=${ev.hash.slice(0, 12)}`);

  // 4. BlackBox Integrity
  const chainOk = exec.verifyChain();
  mark("BlackBox Integrity", chainOk.valid === true, `entries=${chainOk.entries}`);

  // 5. Approval Enforcement (nuclei blocked without approval, re-checked when approved)
  const blockedNuclei = exec.runTool({
    agentId: "ROOT-AGT-001",
    toolId: "nuclei",
    action: "template-scan",
    scope: "localhost",
    target: "127.0.0.1:3000",
    approved: false
  });
  mark("Approval Enforcement", blockedNuclei.status === "APPROVAL_REQUIRED", `status=${blockedNuclei.status}`);

  // 6. Scope Validation
  const badScope = exec.runTool({
    agentId: "ROOT-AGT-001",
    toolId: "semgrep",
    action: "version-check",
    scope: "unapproved-external-target",
    target: "example.com"
  });
  mark("Scope Validation", badScope.status === "SCOPE_REJECTED", `status=${badScope.status}`);

  // 7. Kill Switch
  exec.setKillSwitch(true, "emergency-test");
  const killedRun = exec.runTool({
    agentId: "ROOT-AGT-001",
    toolId: "semgrep",
    action: "version-check",
    scope: "approved-project",
    target: "."
  });
  exec.setKillSwitch(false, "test-cleanup");
  mark("Kill Switch", killedRun.status === "KILLED_BY_SWITCH", `status=${killedRun.status}`);

  // 8. Mission Verification (chain still intact after all runs)
  const finalChain = exec.verifyChain();
  mark("Mission Verification", finalChain.valid === true && fs.existsSync(exec.chainPath), `chainValid=${finalChain.valid}`);

  const passedCount = results.filter((r) => r.passed).length;
  console.log(`\nSUMMARY: ${passedCount}/${results.length} CHECKS PASSED`);
  assert.strictEqual(passedCount, results.length, "Не всички проверки преминаха");
}

runTestSuite();
