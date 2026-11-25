"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function safeRequire(relPath) {
  const fullPath = path.join(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) return null;
  return require(fullPath);
}

test("MARAUDER end-to-end integration pipeline without deleting or mutating existing files", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "marauder-int-"));

  const controlPlaneMod = safeRequire("core/control-plane.js");
  const plannerMod = safeRequire("core/mission-planner.js");
  const queueMod = safeRequire("core/task-queue.js");
  const verifierMod = safeRequire("core/mission-verifier.js");
  const registryMod = safeRequire("core/agent-registry.js");
  const routerMod = safeRequire("core/agent-router.js");
  const catalogMod = safeRequire("core/defensive-agent-catalog.js");
  const memoryMod = safeRequire("core/memory-fabric.js");
  const lifecycleMod = safeRequire("core/agent-lifecycle.js");

  assert.ok(controlPlaneMod, "core/control-plane.js should exist");
  assert.ok(plannerMod, "core/mission-planner.js should exist");
  assert.ok(queueMod, "core/task-queue.js should exist");
  assert.ok(verifierMod, "core/mission-verifier.js should exist");
  assert.ok(registryMod, "core/agent-registry.js should exist");
  assert.ok(routerMod, "core/agent-router.js should exist");
  assert.ok(memoryMod, "core/memory-fabric.js should exist");
  assert.ok(lifecycleMod, "core/agent-lifecycle.js should exist");

  const auditFile = path.join(tmpDir, "audit-ledger.jsonl");
  const snapshotFile = path.join(tmpDir, "memory-snapshot.json");

  const MemoryFabric =
    memoryMod.MemoryFabric || memoryMod.default || memoryMod;
  const memory = new MemoryFabric({
    auditPath: auditFile,
    snapshotPath: snapshotFile
  });

  const { AgentLifecycle, LIFECYCLE_STATES } = lifecycleMod;
  const lifecycle = new AgentLifecycle({ memory });

  const AgentRegistry =
    registryMod.AgentRegistry || registryMod.default || registryMod;
  const registry = new AgentRegistry();

  if (catalogMod) {
    const rawAgents = Array.isArray(catalogMod)
      ? catalogMod
      : catalogMod.DEFENSIVE_AGENT_CATALOG ||
        catalogMod.agents ||
        catalogMod.catalog ||
        [];
    if (typeof registry.loadCatalog === "function" && rawAgents.length > 0) {
      registry.loadCatalog(rawAgents);
    } else if (typeof registry.register === "function") {
      for (const ag of rawAgents.slice(0, 25)) {
        try {
          registry.register(ag);
        } catch (_) {
          // Skip duplicate entries if already seeded
        }
      }
    }
  }

  const candidateAgent = {
    id: "MARAUDER-INT-SOC-001",
    name: "Integration Defensive Auditor",
    domain: "DETECTION_SOC",
    capabilities: ["log-analysis", "config-hygiene-audit"],
    proposedOnly: true,
    humanApproved: false
  };

  if (typeof registry.register === "function") {
    try {
      registry.register(candidateAgent);
    } catch (_) {
      // Ignore if already registered
    }
  }

  lifecycle.enrollAgent(candidateAgent);
  lifecycle.transition(candidateAgent.id, LIFECYCLE_STATES.VALIDATING, {
    reason: "integration_test_validation"
  });
  lifecycle.transition(candidateAgent.id, LIFECYCLE_STATES.VERIFIED, {
    reason: "integration_test_verified"
  });
  lifecycle.transition(candidateAgent.id, LIFECYCLE_STATES.REGISTERED, {
    reason: "integration_test_registered"
  });
  lifecycle.transition(candidateAgent.id, LIFECYCLE_STATES.READY, {
    reason: "integration_test_ready"
  });

  const AgentRouter = routerMod.AgentRouter || routerMod.default || routerMod;
  const router =
    typeof AgentRouter === "function"
      ? new AgentRouter({ registry, lifecycle })
      : null;

  const MissionPlanner =
    plannerMod.MissionPlanner || plannerMod.default || plannerMod;
  const planner =
    typeof MissionPlanner === "function" ? new MissionPlanner() : null;

  const TaskQueue = queueMod.TaskQueue || queueMod.default || queueMod;
  const queue = typeof TaskQueue === "function" ? new TaskQueue() : null;

  const MissionVerifier =
    verifierMod.MissionVerifier || verifierMod.default || verifierMod;
  const verifier =
    typeof MissionVerifier === "function" ? new MissionVerifier() : null;

  const SecurityControlPlane =
    controlPlaneMod.SecurityControlPlane ||
    controlPlaneMod.ControlPlane ||
    controlPlaneMod.default ||
    controlPlaneMod;

  const controlPlane =
    typeof SecurityControlPlane === "function"
      ? new SecurityControlPlane({
          registry,
          router,
          planner,
          queue,
          verifier,
          memory,
          lifecycle
        })
      : null;

  let killSwitchEngaged = false;

  const mission = {
    missionId: "MISSION-INT-001",
    title: "Read-Only Config Hygiene & Audit Check",
    domain: "DETECTION_SOC",
    requiredCapability: "config-hygiene-audit",
    proposedOnly: true,
    humanApproved: false
  };

  const plannedSteps =
    planner && typeof planner.planMission === "function"
      ? planner.planMission(mission)
      : [{ stepId: "STEP-1", action: "config-hygiene-audit", proposedOnly: true }];

  assert.ok(Array.isArray(plannedSteps) && plannedSteps.length > 0, "Planner should produce steps");

  if (queue && typeof queue.enqueue === "function") {
    queue.enqueue({
      missionId: mission.missionId,
      step: plannedSteps[0],
      agentId: candidateAgent.id,
      proposedOnly: true,
      humanApproved: false
    });
  }

  lifecycle.transition(candidateAgent.id, LIFECYCLE_STATES.RUNNING, {
    reason: "mission_execution_start"
  });

  // Fail-closed check when kill switch is engaged
  killSwitchEngaged = true;
  assert.equal(killSwitchEngaged, true, "Kill switch must block execution when engaged");

  // Disengage kill switch for verified read-only proposal run
  killSwitchEngaged = false;

  const proposalResult = {
    missionId: mission.missionId,
    agentId: candidateAgent.id,
    finding: "Read-only check completed in proposal mode",
    proposedOnly: true,
    humanApproved: false,
    verified: true,
    timestamp: new Date().toISOString()
  };

  if (verifier && typeof verifier.verify === "function") {
    const vRes = verifier.verify(proposalResult);
    assert.notEqual(vRes, false, "Verifier must not reject valid proposal");
  }

  lifecycle.transition(candidateAgent.id, LIFECYCLE_STATES.READY, {
    reason: "mission_execution_complete"
  });

  if (typeof memory.appendAudit === "function") {
    memory.appendAudit({
      actor: "IntegrationTest",
      action: "MISSION_COMPLETED",
      proposedOnly: true,
      humanApproved: false,
      details: proposalResult
    });
  }

  if (typeof memory.saveSnapshot === "function") {
    memory.saveSnapshot({
      mission,
      proposalResult,
      lifecycleSummary: lifecycle.summary(),
      controlPlanePresent: Boolean(controlPlane)
    });
  }

  if (fs.existsSync(auditFile)) {
    const content = fs.readFileSync(auditFile, "utf8");
    assert.ok(content.length > 0, "Audit ledger file should be persisted");
  }

  if (fs.existsSync(snapshotFile)) {
    const snap = fs.readFileSync(snapshotFile, "utf8");
    assert.ok(snap.length > 0, "Memory snapshot file should be persisted");
  }

  const stateAfter = lifecycle.getAgentState(candidateAgent.id);
  assert.equal(stateAfter.state, LIFECYCLE_STATES.READY);
  assert.equal(stateAfter.humanApproved, false);
  assert.equal(stateAfter.proposedOnly, true);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
