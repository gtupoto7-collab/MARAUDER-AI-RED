"use strict";

function buildControlPlaneDiagnostics(controlPlane, options = {}) {
  if (!controlPlane || !controlPlane.memory) {
    throw new Error("VALID_CONTROL_PLANE_WITH_MEMORY_REQUIRED");
  }

  const memory = controlPlane.memory;
  const memSnap = typeof memory.getSnapshot === "function"
    ? memory.getSnapshot()
    : {
        incidentsCount: memory.incidents ? memory.incidents.size : 0,
        policiesCount: memory.policies ? memory.policies.size : 0,
        assetsCount: memory.assets ? memory.assets.size : 0,
        knowledgeCount: memory.knowledge ? memory.knowledge.size : 0,
        missionsCount: memory.missions ? memory.missions.size : 0,
        reportsCount: memory.reports ? memory.reports.size : 0,
        checkpointsCount: memory.checkpoints ? memory.checkpoints.size : 0,
        auditCount: Array.isArray(memory.auditLedger) ? memory.auditLedger.length : 0
      };

  const auditIntegrity = typeof memory.verifyAuditChain === "function"
    ? memory.verifyAuditChain()
    : { valid: false, reason: "VERIFY_AUDIT_CHAIN_UNAVAILABLE" };

  const missionsMap = memory.missions instanceof Map ? Array.from(memory.missions.values()) : [];
  const humanApprovedMissionsCount = missionsMap.filter((m) => m && m.humanApproved === true).length;

  const defaultPolicy = typeof memory.getPolicy === "function"
    ? memory.getPolicy("POL-HUMAN-APPROVAL-DEFAULT")
    : null;

  const plugins = controlPlane.plugins instanceof Map
    ? Array.from(controlPlane.plugins.values())
    : [];

  const evaluatorReports =
    controlPlane.router &&
    controlPlane.router.evaluator &&
    typeof controlPlane.router.evaluator.listReports === "function"
      ? controlPlane.router.evaluator.listReports()
      : [];

  const healthy = Boolean(auditIntegrity && auditIntegrity.valid === true);

  return {
    ok: healthy,
    service: "MARAUDER-SECURITY-CONTROL-PLANE",
    checkedAt: new Date().toISOString(),
    snapshotDir: options.snapshotDir || null,
    safetyBoundaries: {
      defaultHumanApproved: false,
      automaticWeaponsRelease: false,
      requireRootController: true,
      defaultPolicyPresent: Boolean(defaultPolicy && defaultPolicy.enabled !== false),
      humanApprovedMissionsCount
    },
    auditIntegrity,
    memory: memSnap,
    plugins,
    evaluator: evaluatorReports
  };
}

module.exports = { buildControlPlaneDiagnostics };
