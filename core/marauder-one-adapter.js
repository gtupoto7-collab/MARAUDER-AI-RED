"use strict";

const fs = require("fs");
const path = require("path");

function tryRequire(relPath) {
  const full = path.join(process.cwd(), relPath);
  if (!fs.existsSync(full)) return null;
  try {
    return require(full);
  } catch (err) {
    return { __loadError: err.message, __path: relPath };
  }
}

class MarauderOneAdapter {
  constructor(options = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.killSwitchEngaged = false;
    this.killSwitchReason = null;

    this.modules = {
      controlPlane: tryRequire("core/control-plane.js"),
      controlPlaneStatus: tryRequire("core/control-plane-status.js"),
      missionPlanner: tryRequire("core/mission-planner.js"),
      taskQueue: tryRequire("core/task-queue.js"),
      missionVerifier: tryRequire("core/mission-verifier.js"),
      agentRegistry: tryRequire("core/agent-registry.js"),
      agentRouter: tryRequire("core/agent-router.js"),
      defensiveCatalog: tryRequire("core/defensive-agent-catalog.js"),
      memoryFabric: tryRequire("core/memory-fabric.js"),
      agentLifecycle: tryRequire("core/agent-lifecycle.js"),
      agentSupervisor: tryRequire("core/agent-supervisor.js"),
      modelGateway: tryRequire("modules/model-gateway.js")
    };

    this.lifecycle =
      this.modules.agentLifecycle && this.modules.agentLifecycle.AgentLifecycle
        ? new this.modules.agentLifecycle.AgentLifecycle()
        : null;

    this.supervisor =
      this.modules.agentSupervisor && this.modules.agentSupervisor.AgentSupervisor
        ? new this.modules.agentSupervisor.AgentSupervisor({ lifecycle: this.lifecycle })
        : null;
  }

  engageKillSwitch(reason = "MANUAL_OPERATOR_LOCK") {
    this.killSwitchEngaged = true;
    this.killSwitchReason = reason;
    return {
      ok: true,
      killSwitchEngaged: true,
      reason: this.killSwitchReason,
      readOnlyAllowed: true,
      executionBlocked: true
    };
  }

  releaseKillSwitch(reason = "OPERATOR_RELEASE") {
    this.killSwitchEngaged = false;
    this.killSwitchReason = null;
    return {
      ok: true,
      killSwitchEngaged: false,
      releaseReason: reason,
      proposedOnly: true,
      humanApproved: false
    };
  }

  getCanonicalContractStatus() {
    const loadErrors = [];
    const available = [];

    for (const [key, mod] of Object.entries(this.modules)) {
      if (!mod) continue;
      if (mod.__loadError) {
        loadErrors.push({ module: key, path: mod.__path, error: mod.__loadError });
      } else {
        available.push(key);
      }
    }

    return {
      ok: loadErrors.length === 0,
      brand: "MARAUDER-AI",
      architecture: "MARAUDER_ONE_CANONICAL",
      uiContract: "ONE_UI_CONTRACT",
      killSwitchEngaged: this.killSwitchEngaged,
      killSwitchReason: this.killSwitchReason,
      proposedOnly: true,
      humanApproved: false,
      availableCoreModules: available,
      loadErrors,
      lifecycleSummary: this.lifecycle ? this.lifecycle.summary() : null,
      supervisorSummary: this.supervisor ? this.supervisor.getSummary() : null
    };
  }

  guardExecution(actionMeta = {}) {
    if (this.killSwitchEngaged) {
      return {
        allowed: false,
        blocked: true,
        reason: "KILL_SWITCH_ENGAGED",
        killSwitchReason: this.killSwitchReason,
        action: actionMeta.action || "UNSPECIFIED"
      };
    }

    if (actionMeta.requiresHumanApproval === true && actionMeta.humanApproved !== true) {
      return {
        allowed: false,
        blocked: true,
        reason: "HUMAN_APPROVAL_REQUIRED",
        action: actionMeta.action || "UNSPECIFIED"
      };
    }

    return {
      allowed: true,
      blocked: false,
      proposedOnly: true,
      humanApproved: false
    };
  }
}

module.exports = {
  MarauderOneAdapter
};
