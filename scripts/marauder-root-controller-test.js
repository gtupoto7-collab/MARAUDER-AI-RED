const assert = require("assert");
const { MarauderRootController } = require("../modules/marauder-root-controller");

function runRootControllerTest() {
  const ctrl = new MarauderRootController(process.cwd());
  ctrl.setKillSwitch(false, "clean-start");

  const checks = [];
  const record = (label, ok, note = "") => {
    checks.push({ label, ok, note });
    console.log(`[${ok ? "PASS" : "FAIL"}] ${label}${note ? ` (${note})` : ""}`);
  };

  // 1. Agent Identity (rejects forged object, accepts signed issued agent)
  const forged = { agentId: "ROOT-001", rank: "ROOT", tokenSignature: "fake" };
  const badAuth = ctrl.verifyAgentIdentity(forged);
  const rootAgent = ctrl.issueRootAgent({ agentId: "ROOT-001", callsign: "SOVEREIGN-ROOT" });
  const goodAuth = ctrl.verifyAgentIdentity(rootAgent);
  record("Agent Identity", !badAuth.valid && goodAuth.valid, `forged=${badAuth.reason}, signed=${goodAuth.valid}`);

  // 2. Capability Verification
  const restricted = ctrl.issueRootAgent({ agentId: "ROOT-002", callsign: "READ-ONLY-ROOT", capabilities: ["code.audit"] });
  const deniedCap = ctrl.executeMission({
    agentToken: restricted,
    missionId: "MIS-CAP-1",
    toolId: "nmap",
    scope: "localhost",
    target: "127.0.0.1"
  });
  record("Capability Verification", deniedCap.status === "CAPABILITY_DENIED", `status=${deniedCap.status}`);

  // 3. Target Validation (rejects mismatched target vs scope)
  const badTarget = ctrl.executeMission({
    agentToken: rootAgent,
    missionId: "MIS-TGT-1",
    toolId: "semgrep",
    scope: "localhost",
    target: "external-example.com"
  });
  record("Target Validation", badTarget.status === "SCOPE_DENIED", `status=${badTarget.status}`);

  // 4. Approval Authentication (blocks unapproved nuclei, allows single-use signed approval, blocks replay)
  const noApr = ctrl.executeMission({
    agentToken: rootAgent,
    missionId: "MIS-APR-1",
    toolId: "nuclei",
    action: "version-check",
    scope: "localhost",
    target: "127.0.0.1"
  });
  const apr = ctrl.issueApproval({
    approverId: "ADM-ROOT",
    missionId: "MIS-APR-1",
    toolId: "nuclei",
    target: "127.0.0.1",
    scope: "localhost",
    ttlSeconds: 120
  });
  const replayAttempt = ctrl.consumeApproval(apr.tokenId, {
    missionId: "MIS-APR-1",
    toolId: "nuclei",
    target: "127.0.0.1",
    scope: "localhost"
  });
  record(
    "Approval Authentication",
    noApr.status === "APPROVAL_DENIED" && replayAttempt.valid === true && ctrl.consumeApproval(apr.tokenId, {
      missionId: "MIS-APR-1",
      toolId: "nuclei",
      target: "127.0.0.1",
      scope: "localhost"
    }).reason === "APPROVAL_ALREADY_USED",
    "single-use + context bound"
  );

  // 5. Tool Integrity
  const semInfo = ctrl.inspectToolIntegrity("semgrep");
  record("Tool Integrity", semInfo.ok === true && typeof semInfo.health === "string", `semgrep=${semInfo.health}`);

  // 6. Real Execution
  const execRes = ctrl.executeMission({
    agentToken: rootAgent,
    missionId: "MIS-REAL-1",
    toolId: "semgrep",
    action: "version-check",
    scope: "approved-project",
    target: ".",
    allowLocalNodeAudit: true
  });
  record("Real Execution", execRes.evidence && typeof execRes.evidence.exitCode === "number", `mode=${execRes.evidence.executionMode}, exit=${execRes.evidence.exitCode}`);

  // 7. Execution Evidence
  const ev = execRes.evidence;
  record(
    "Execution Evidence",
    Boolean(ev && ev.executionId && ev.startedAt && ev.finishedAt && ev.stdout.length > 0),
    `id=${ev.executionId}, dur=${ev.durationMs}ms`
  );

  // 8. Cryptographic Audit Chain
  const chainStatus = ctrl.verifyAuditChain();
  record("Cryptographic Audit Chain", chainStatus.valid === true && chainStatus.count > 0, `entries=${chainStatus.count}`);

  // 9. Kill Switch
  ctrl.setKillSwitch(true, "drill-stop");
  const stopped = ctrl.executeMission({
    agentToken: rootAgent,
    missionId: "MIS-KS-1",
    toolId: "semgrep",
    scope: "approved-project",
    target: ".",
    allowLocalNodeAudit: true
  });
  ctrl.setKillSwitch(false, "drill-resume");
  record("Kill Switch", stopped.status === "KILLED", `status=${stopped.status}`);

  // 10. Independent Verification
  record("Independent Verification", execRes.verification && execRes.verification.verified === true, `reason=${execRes.verification.reason}`);

  const passed = checks.filter((c) => c.ok).length;
  console.log(`\nMARAUDER ROOT CONTROLLER\nFINAL: ${passed}/${checks.length}`);
  assert.strictEqual(passed, checks.length, "Не всички проверки минаха");
}

runRootControllerTest();
