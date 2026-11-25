"use strict";

class MissionVerifier {
  verify(mission) {
    if (!mission || !Array.isArray(mission.tasks)) {
      return {
        verified: false,
        reason: "INVALID_MISSION_OBJECT",
        completedTasks: 0,
        totalTasks: 0
      };
    }

    const totalTasks = mission.tasks.length;
    const completedTasks = mission.tasks.filter((t) => t.status === "completed").length;
    const failedTasks = mission.tasks.filter((t) => t.status === "failed");
    const heldTasks = mission.tasks.filter((t) => t.status === "held_approval" || t.status === "blocked_root");
    const missingEvidence = mission.tasks.filter(
      (t) => t.status === "completed" && (!t.result || t.result.ok !== true)
    );

    const verified =
      totalTasks > 0 &&
      completedTasks === totalTasks &&
      failedTasks.length === 0 &&
      heldTasks.length === 0 &&
      missingEvidence.length === 0;

    return {
      verified,
      missionId: mission.id,
      completedTasks,
      totalTasks,
      failedCount: failedTasks.length,
      heldCount: heldTasks.length,
      missingEvidenceCount: missingEvidence.length,
      status: verified ? "VERIFIED" : "NEEDS_ATTENTION"
    };
  }
}

module.exports = { MissionVerifier };
