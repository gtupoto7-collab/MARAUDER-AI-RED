const fs = require("fs");
const path = require("path");

const ENGINE_PATH = path.join(__dirname, "..", "data", "autonomous-security-engine.json");

function loadAutonomousEngine() {
  if (!fs.existsSync(ENGINE_PATH)) {
    return {
      engine: "AUTONOMOUS SECURITY ENGINE",
      defaults: { target: "", scope: "approved assets only", mode: "continuous", risk: "production-safe", autoFix: false },
      liveTelemetry: {},
      findings: [],
      pendingApprovals: []
    };
  }
  return JSON.parse(fs.readFileSync(ENGINE_PATH, "utf8"));
}

function saveAutonomousEngine(state) {
  fs.writeFileSync(ENGINE_PATH, JSON.stringify(state, null, 2), "utf8");
  return state;
}

function classifyAction({ inApprovedScope = false, invasive = false, dangerous = false } = {}) {
  if (dangerous || !inApprovedScope) {
    return { tier: "BLOCKED", allowedWithoutApproval: false, reason: "Извън разрешения scope или маркирано като опасно действие." };
  }
  if (invasive) {
    return { tier: "APPROVAL", allowedWithoutApproval: false, reason: "Изисква изрично APPROVE преди изпълнение." };
  }
  return { tier: "AUTO", allowedWithoutApproval: true, reason: "Безопасна проверка в рамките на одобрения scope." };
}

function runSecurityCheckCycle({ target, scope = "approved assets", mode = "continuous", risk = "production-safe", autoFix = false, approvedAssetsCount = 1 } = {}) {
  const state = loadAutonomousEngine();
  if (state.liveTelemetry && state.liveTelemetry.emergencyStop) {
    return { ok: false, error: "EMERGENCY STOP е активен. Освободи го преди нов цикъл." };
  }

  const cleanTarget = String(target || state.defaults.target || "").trim();
  if (!cleanTarget) {
    return { ok: false, error: "Посочи валиден TARGET в рамките на разрешения scope." };
  }

  const count = Math.max(1, Number(approvedAssetsCount) || 1);
  const nowIso = new Date().toISOString();

  state.defaults = {
    target: cleanTarget,
    scope: String(scope || "approved assets"),
    mode: String(mode || "continuous"),
    risk: String(risk || "production-safe"),
    autoFix: Boolean(autoFix)
  };

  state.liveTelemetry = {
    ...state.liveTelemetry,
    assetsTotal: count,
    healthy: count,
    needsAttention: 0,
    critical: 0,
    lastScan: nowIso,
    nextScan: mode === "continuous" ? "automatic" : "manual",
    activeAgents: 1,
    threatsDetected: 0,
    falsePositives: 0,
    emergencyStop: false
  };

  saveAutonomousEngine(state);
  return {
    ok: true,
    target: cleanTarget,
    loopCompleted: state.loopStages,
    telemetry: state.liveTelemetry,
    note: "Цикълът завърши в безопасен режим без измислени находки — очаква реални входни данни от целта."
  };
}

function setEmergencyStop(active = true) {
  const state = loadAutonomousEngine();
  state.liveTelemetry.emergencyStop = Boolean(active);
  saveAutonomousEngine(state);
  return { ok: true, emergencyStop: state.liveTelemetry.emergencyStop };
}

module.exports = {
  loadAutonomousEngine,
  classifyAction,
  runSecurityCheckCycle,
  setEmergencyStop
};
