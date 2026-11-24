const fs = require("fs");
const path = require("path");

const STORE_PATH = path.join(__dirname, "..", "data", "director-os.json");
const ALLOWED_DECISIONS = ["APPROVE", "REJECT", "REVIEW", "EXECUTE", "AUDIT"];

function loadDirectorState() {
  if (!fs.existsSync(STORE_PATH)) {
    return {
      osName: "RED COMMAND — DIRECTOR OS",
      executiveCommand: [],
      departments: [],
      projects: [],
      approvalsQueue: [],
      tasks: [],
      auditLog: [],
      emergencyStop: false
    };
  }
  return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
}

function saveDirectorState(state) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(state, null, 2), "utf8");
  return state;
}

function appendAudit(state, actor, action, detail) {
  state.auditLog = state.auditLog || [];
  state.auditLog.push({
    ts: new Date().toISOString(),
    actor: String(actor || "CEO / FOUNDER"),
    action: String(action || "AUDIT"),
    detail: String(detail || "")
  });
}

function applyApprovalDecision(approvalId, decision, actor = "CEO / FOUNDER") {
  const norm = String(decision || "").toUpperCase();
  if (!ALLOWED_DECISIONS.includes(norm)) {
    return { ok: false, error: `Невалидно действие '${decision}'. Разрешени: ${ALLOWED_DECISIONS.join(", ")}.` };
  }
  const state = loadDirectorState();
  if (state.emergencyStop && norm === "EXECUTE") {
    appendAudit(state, actor, "BLOCKED_EXECUTE", `Опит за EXECUTE при активен EMERGENCY STOP за ${approvalId}.`);
    saveDirectorState(state);
    return { ok: false, error: "EMERGENCY STOP е активен. Първо деактивирай аварийния стоп." };
  }

  const item = (state.approvalsQueue || []).find((a) => a.id === approvalId);
  if (!item) {
    return { ok: false, error: `Заявка '${approvalId}' не е намерена.` };
  }

  item.decision = norm;
  item.updatedAt = new Date().toISOString();
  appendAudit(state, actor, norm, `${approvalId} (${item.title}) -> ${norm}`);
  saveDirectorState(state);
  return { ok: true, approval: item, state };
}

function triggerEmergencyStop(actor = "CEO / FOUNDER", reason = "Ръчно аварийно спиране от ръководството") {
  const state = loadDirectorState();
  state.emergencyStop = true;
  (state.tasks || []).forEach((t) => {
    if (t.state === "RUNNING" || t.state === "OPEN") {
      t.state = "HALTED";
    }
  });
  appendAudit(state, actor, "EMERGENCY STOP", reason);
  saveDirectorState(state);
  return { ok: true, emergencyStop: true, state };
}

function clearEmergencyStop(actor = "CEO / FOUNDER") {
  const state = loadDirectorState();
  state.emergencyStop = false;
  appendAudit(state, actor, "CLEAR EMERGENCY STOP", "Аварийният стоп е освободен от CEO / FOUNDER.");
  saveDirectorState(state);
  return { ok: true, emergencyStop: false, state };
}

function addProject(projectInput, actor = "CEO / FOUNDER") {
  const state = loadDirectorState();
  const name = String(projectInput.name || "").trim();
  if (!name) return { ok: false, error: "Проектът изисква име." };

  const id = `PRJ-${Date.now().toString(36).toUpperCase()}`;
  const proj = {
    id,
    name,
    director: String(projectInput.director || "MARAUDER COMMANDER").trim(),
    agents: Array.isArray(projectInput.agents)
      ? projectInput.agents
      : String(projectInput.agents || "MARAUDER COMMANDER").split(",").map((s) => s.trim()).filter(Boolean),
    budget: String(projectInput.budget || "TBD").trim(),
    deadline: String(projectInput.deadline || "TBD").trim(),
    status: String(projectInput.status || "PLANNED").trim(),
    history: [`Създаден проект от ${actor}`],
    report: String(projectInput.report || "Няма изпълнени проверки все още.").trim()
  };

  state.projects = state.projects || [];
  state.projects.push(proj);
  appendAudit(state, actor, "CREATE_PROJECT", `${id}: ${name}`);
  saveDirectorState(state);
  return { ok: true, project: proj, state };
}

module.exports = {
  loadDirectorState,
  applyApprovalDecision,
  triggerEmergencyStop,
  clearEmergencyStop,
  addProject
};
