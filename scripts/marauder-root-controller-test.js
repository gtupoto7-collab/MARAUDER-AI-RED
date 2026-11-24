const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { MarauderRootController } = require("../modules/marauder-root-controller");

function makeEnvelope(ctrl, overrides = {}) {
  const now = Date.now();
  const env = {
    agent: { id: "AI-AGT-001" },
    mode: "COMMAND",
    capability: "catalog:read",
    scope: "catalog:agents",
    nonce: crypto.randomUUID(),
    issuedAt: now,
    expiresAt: now + 60000,
    payload: { action: "list" },
    ...overrides
  };
  const sig = overrides.signatureHex !== undefined
    ? overrides.signatureHex
    : ctrl.signRequest(env);
  return { env, sig };
}

function runRootControllerTest() {
  const ctrl = new MarauderRootController({ rootDir: process.cwd() });
  ctrl.setKillSwitch(false, "clean-start");
  ctrl.revokePrivilegeMode("clean-start");

  const checks = [];
  const record = (label, ok, note = "") => {
    checks.push({ label, ok, note });
    console.log(`[${ok ? "PASS" : "FAIL"}] ${label}${note ? ` (${note})` : ""}`);
  };

  // 1. Registered Agent Profile & Unknown Agent Rejection
  const knownProfile = ctrl.getRegisteredProfile("AI-AGT-001");
  const unknownReq = makeEnvelope(ctrl, { agent: { id: "AI-AGT-UNKNOWN-999999" } });
  const unknownRes = ctrl.authorizeAndPrepare(unknownReq.env, unknownReq.sig);
  record(
    "Registered Profile & Default-Deny Unknown",
    Boolean(knownProfile && knownProfile.id === "AI-AGT-001") &&
      !unknownRes.allowed &&
      unknownRes.reason === "AGENT_NOT_IN_REGISTRY",
    `known=${knownProfile?.role}, unknownReason=${unknownRes.reason}`
  );

  // 2. HMAC Signature Verification
  const badSigReq = makeEnvelope(ctrl, { signatureHex: "0".repeat(64) });
  const badSigRes = ctrl.authorizeAndPrepare(badSigReq.env, badSigReq.sig);
  record(
    "HMAC Request Signature",
    !badSigRes.allowed && badSigRes.reason === "INVALID_HMAC_SIGNATURE",
    `reason=${badSigRes.reason}`
  );

  // 3. Nonce Replay & Expiry
  const sharedNonce = `nonce-${crypto.randomUUID()}`;
  const firstNonceReq = makeEnvelope(ctrl, { nonce: sharedNonce });
  const firstNonceRes = ctrl.authorizeAndPrepare(firstNonceReq.env, firstNonceReq.sig);
  const replayReq = makeEnvelope(ctrl, { nonce: sharedNonce });
  const replayRes = ctrl.authorizeAndPrepare(replayReq.env, replayReq.sig);
  const expiredReq = makeEnvelope(ctrl, { expiresAt: Date.now() - 1000 });
  const expiredRes = ctrl.authorizeAndPrepare(expiredReq.env, expiredReq.sig);
  record(
    "Nonce Replay & Expiry",
    firstNonceRes.allowed &&
      !replayRes.allowed &&
      replayRes.reason === "REPLAY_OR_MISSING_NONCE" &&
      !expiredRes.allowed &&
      expiredRes.reason === "TOKEN_EXPIRED",
    `replay=${replayRes.reason}, expired=${expiredRes.reason}`
  );

  // 4. Capability & Scope Default-Deny
  const badCapReq = makeEnvelope(ctrl, { capability: "root:unrestricted-shell", scope: "catalog:agents" });
  const badCapRes = ctrl.authorizeAndPrepare(badCapReq.env, badCapReq.sig);
  const badScopeReq = makeEnvelope(ctrl, { capability: "catalog:read", scope: "external:internet" });
  const badScopeRes = ctrl.authorizeAndPrepare(badScopeReq.env, badScopeReq.sig);
  record(
    "Capability & Scope Policy",
    !badCapRes.allowed &&
      badCapRes.reason === "CAPABILITY_NOT_ALLOWED_DEFAULT_DENY" &&
      !badScopeRes.allowed &&
      badScopeRes.reason === "SCOPE_VIOLATION_DEFAULT_DENY",
    `cap=${badCapRes.reason}, scope=${badScopeRes.reason}`
  );

  // 5. One-Time Approval (sandbox:exec)
  const payload = { target: "sandbox-check" };
  const noAprReq = makeEnvelope(ctrl, {
    agent: { id: "AI-AGT-002" },
    capability: "sandbox:exec",
    scope: "sandbox:isolated",
    payload
  });
  const noAprRes = ctrl.authorizeAndPrepare(noAprReq.env, noAprReq.sig);

  const approvalId = ctrl.issueOneTimeApproval({
    agentId: "AI-AGT-002",
    capability: "sandbox:exec",
    scope: "sandbox:isolated",
    actionPayload: payload,
    ttlMs: 60000
  });

  const aprReq1 = makeEnvelope(ctrl, {
    agent: { id: "AI-AGT-002" },
    capability: "sandbox:exec",
    scope: "sandbox:isolated",
    approvalId,
    payload
  });
  const aprRes1 = ctrl.authorizeAndPrepare(aprReq1.env, aprReq1.sig, () => ({ executed: "sandbox-ok" }));

  const aprReq2 = makeEnvelope(ctrl, {
    agent: { id: "AI-AGT-002" },
    capability: "sandbox:exec",
    scope: "sandbox:isolated",
    approvalId,
    payload
  });
  const aprRes2 = ctrl.authorizeAndPrepare(aprReq2.env, aprReq2.sig, () => ({ executed: "sandbox-ok" }));
  record(
    "One-Time Approval & Replay Block",
    !noAprRes.allowed &&
      noAprRes.reason === "INVALID_OR_MISSING_ONE_TIME_APPROVAL" &&
      aprRes1.allowed &&
      !aprRes2.allowed &&
      aprRes2.reason === "INVALID_OR_MISSING_ONE_TIME_APPROVAL",
    `first=${aprRes1.allowed}, secondReason=${aprRes2.reason}`
  );

  // 6. Privileged Grant & Revocation (privileged:ops)
  const noPrivReq = makeEnvelope(ctrl, {
    capability: "privileged:ops",
    scope: "local:machine",
    payload: { check: "pkg-size" }
  });
  const noPrivRes = ctrl.authorizeAndPrepare(noPrivReq.env, noPrivReq.sig);

  ctrl.grantPrivilegeMode({ agentIds: ["AI-AGT-001"], ttlMs: 60000, reason: "test-grant" });
  const privReq = makeEnvelope(ctrl, {
    capability: "privileged:ops",
    scope: "local:machine",
    payload: { check: "pkg-size" }
  });
  const privRes = ctrl.authorizeAndPrepare(privReq.env, privReq.sig, ({ scope }) => {
    const pkgStat = fs.statSync(path.join(process.cwd(), "package.json"));
    return { scope, packageBytes: pkgStat.size };
  });

  ctrl.revokePrivilegeMode("test-revoke");
  const afterRevokeReq = makeEnvelope(ctrl, {
    capability: "privileged:ops",
    scope: "local:machine",
    payload: { check: "pkg-size" }
  });
  const afterRevokeRes = ctrl.authorizeAndPrepare(afterRevokeReq.env, afterRevokeReq.sig);
  record(
    "Privilege Lease Grant & Revoke",
    !noPrivRes.allowed &&
      noPrivRes.reason === "PRIVILEGED_MODE_NOT_GRANTED_BY_OWNER" &&
      privRes.allowed &&
      typeof privRes.resultHash === "string" &&
      !afterRevokeRes.allowed &&
      afterRevokeRes.reason === "PRIVILEGED_MODE_NOT_GRANTED_BY_OWNER",
    `granted=${privRes.allowed}, hash=${privRes.resultHash?.slice(0, 12)}`
  );

  // 7. Kill Switch
  ctrl.setKillSwitch(true, "test-kill");
  const ksReq = makeEnvelope(ctrl);
  const ksRes = ctrl.authorizeAndPrepare(ksReq.env, ksReq.sig);
  ctrl.setKillSwitch(false, "test-restore");
  record(
    "Kill Switch Enforcement",
    !ksRes.allowed && ksRes.reason === "KILL_SWITCH_ACTIVE",
    `reason=${ksRes.reason}`
  );

  // 8. BlackBox Ledger Integrity
  const ledger = ctrl.verifyLedger();
  record(
    "BlackBox Ledger Integrity",
    ledger.valid === true && ledger.entries > 0,
    `valid=${ledger.valid}, entries=${ledger.entries}`
  );

  const passed = checks.filter((c) => c.ok).length;
  console.log(`\nMARAUDER ROOT CONTROLLER\nFINAL: ${passed}/${checks.length}`);
  assert.strictEqual(passed, checks.length, "Не всички проверки на Root Controller минаха");
}

runRootControllerTest();
