"use strict";

const assert = require("node:assert/strict");
const { MarauderOneAdapter } = require("../core/marauder-one-adapter");

const adapter = new MarauderOneAdapter();
const initialStatus = adapter.getCanonicalContractStatus();

assert.equal(initialStatus.brand, "MARAUDER-AI");
assert.equal(initialStatus.killSwitchEngaged, false);

const locked = adapter.engageKillSwitch("BUILD_CHECK");
assert.equal(locked.killSwitchEngaged, true);

const blockedAction = adapter.guardExecution({ action: "EXTERNAL_ACTION" });
assert.equal(blockedAction.allowed, false);
assert.equal(blockedAction.reason, "KILL_SWITCH_ENGAGED");

const unlocked = adapter.releaseKillSwitch("BUILD_CHECK_DONE");
assert.equal(unlocked.killSwitchEngaged, false);

const approvalCheck = adapter.guardExecution({
  action: "SENSITIVE_CHANGE",
  requiresHumanApproval: true,
  humanApproved: false
});
assert.equal(approvalCheck.allowed, false);
assert.equal(approvalCheck.reason, "HUMAN_APPROVAL_REQUIRED");

console.log(JSON.stringify({
  canonicalBuildReady: initialStatus.loadErrors.length === 0,
  status: adapter.getCanonicalContractStatus()
}, null, 2));
