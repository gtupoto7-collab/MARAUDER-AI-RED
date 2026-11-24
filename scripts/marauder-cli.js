#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { MarauderRootController, sha256 } = require("../modules/marauder-root-controller");
const { SynchroMeshOrchestrator } = require("../modules/synchro-mesh");

const ROOT_DIR = process.cwd();
const STATE_FILE = path.join(ROOT_DIR, "data", "real-execution", "privilege-state.json");
const INDEX_FILE = path.join(ROOT_DIR, "data", "agent-army", "ids-index.json");

function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args[0] || "status";
  const opts = {};

  for (let i = 1; i < args.length; i += 1) {
    const token = args[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        opts[key] = next;
        i += 1;
      } else {
        opts[key] = true;
      }
    }
  }
  return { cmd, opts };
}

function loadPrivilegeState() {
  if (!fs.existsSync(STATE_FILE)) {
    return { active: false, agentIds: [], grantedAt: null, expiresAt: null, reason: null };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    return {
      active: Boolean(parsed.active),
      agentIds: Array.isArray(parsed.agentIds) ? parsed.agentIds : [],
      grantedAt: parsed.grantedAt || null,
      expiresAt: parsed.expiresAt || null,
      reason: parsed.reason || null
    };
  } catch {
    return { active: false, agentIds: [], grantedAt: null, expiresAt: null, reason: null };
  }
}

function savePrivilegeState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n", "utf8");
}

function createControllerWithPersistedState() {
  const ctrl = new MarauderRootController({ rootDir: ROOT_DIR });
  const st = loadPrivilegeState();
  const now = Date.now();

  if (st.active) {
    if (st.expiresAt && st.expiresAt <= now) {
      savePrivilegeState({ active: false, agentIds: [], grantedAt: null, expiresAt: null, reason: "EXPIRED" });
      ctrl.revokePrivilegeMode("PERSISTED_PRIVILEGE_EXPIRED");
    } else {
      const remainingMs = st.expiresAt ? Math.max(1000, st.expiresAt - now) : 300000;
      ctrl.privilegedGrant = {
        active: true,
        agentIds: new Set(st.agentIds.map(String)),
        grantedAt: st.grantedAt || now,
        expiresAt: now + remainingMs,
        reason: st.reason || "PERSISTED_OWNER_GRANT"
      };
    }
  }
  return ctrl;
}

function loadRealIds(limitCount) {
  if (fs.existsSync(INDEX_FILE)) {
    const idx = JSON.parse(fs.readFileSync(INDEX_FILE, "utf8"));
    const list = Array.isArray(idx.allIds) ? idx.allIds : [];
    return typeof limitCount === "number" ? list.slice(0, limitCount) : list;
  }
  const agentsPath = path.join(ROOT_DIR, "data", "agent-army", "agents.json");
  const raw = JSON.parse(fs.readFileSync(agentsPath, "utf8"));
  const list = Array.isArray(raw) ? raw : raw.agents;
  const ids = list.map((a) => String(a.id)).filter(Boolean);
  return typeof limitCount === "number" ? ids.slice(0, limitCount) : ids;
}

async function cmdMission(ctrl, opts) {
  const concurrency = Math.max(1, Number(opts.concurrency || 8));
  const count = Math.max(1, Number(opts.count || 12));
  const missionId = String(opts.id || `MISSION-CLI-${Date.now()}`);
  const mode = String(opts.mode || "audit"); // "audit" | "privileged"

  const ids = loadRealIds(count);
  const mesh = new SynchroMeshOrchestrator({ rootDir: ROOT_DIR, concurrency, controller: ctrl });

  const missionNode = mesh.graph.upsertNode("INCIDENT", missionId, { mode, count: ids.length }, "MARAUDER-CLI");

  const tasks = ids.map((agentId, idx) => {
    const profile = mesh.getAgentProfile(agentId);
    const usePriv = mode === "privileged";

    return {
      id: `TASK-${String(idx + 1).padStart(4, "0")}`,
      agentId,
      capability: usePriv ? "privileged:ops" : "audit:file-hash",
      scope: usePriv ? "local:machine" : "project:files",
      retries: 0,
      dependsOn: [],
      runner: ({ agent, graph }) => {
        const targetRel = idx % 2 === 0 ? "modules/marauder-root-controller.js" : "modules/synchro-mesh.js";
        const abs = path.join(ROOT_DIR, targetRel);
        const digest = fs.existsSync(abs) ? sha256(fs.readFileSync(abs)) : "MISSING";
        const fileNodeId = graph.upsertNode("FILE", targetRel, { sha256: digest }, agent.id);
        graph.link(fileNodeId, missionNode, usePriv ? "PRIVILEGED_CHECK" : "AUDITED_IN");
        return {
          agentId: agent.id,
          role: profile ? profile.role : agent.role,
          file: targetRel,
          sha256: digest,
          privilegedModeActive: ctrl.hasActivePrivilege(agent.id)
        };
      }
    };
  });

  const started = Date.now();
  const report = await mesh.runMission(missionId, tasks);
  const elapsedMs = Date.now() - started;

  console.log(JSON.stringify({
    command: "mission",
    missionId: report.missionId,
    mode,
    concurrency,
    requestedTasks: tasks.length,
    completedCount: report.completedCount,
    failedCount: report.failedCount,
    failedDetails: report.failed,
    elapsedMs,
    graph: report.graph,
    ledger: report.ledger,
    missionDigest: report.missionDigest
  }, null, 2));

  if (report.failedCount > 0) {
    process.exitCode = 1;
  }
}

function printHelp() {
  console.log(`MARAUDER CLI v1 — Управление на привилегии, мисии и BlackBox одит

Употреба:
  node scripts/marauder-cli.js status
  node scripts/marauder-cli.js grant [--ttl-sec 300] [--agents AI-AGT-001,AI-AGT-002] [--reason OWNER_GRANT]
  node scripts/marauder-cli.js revoke [--reason OWNER_REVOKE]
  node scripts/marauder-cli.js verify-ledger
  node scripts/marauder-cli.js mission [--count 12] [--concurrency 8] [--mode audit|privileged] [--id MISSION-ID]
`);
}

async function main() {
  const { cmd, opts } = parseArgs(process.argv);

  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    return;
  }

  const ctrl = createControllerWithPersistedState();

  if (cmd === "status") {
    const ledger = ctrl.verifyLedger();
    const st = loadPrivilegeState();
    console.log(JSON.stringify({
      command: "status",
      killSwitchActive: ctrl.killSwitchActive,
      privilegeGrant: {
        active: ctrl.hasActivePrivilege("ANY_CHECK"),
        persistedActive: st.active,
        agentIdsCount: st.agentIds.length,
        expiresAt: st.expiresAt,
        reason: st.reason
      },
      ledger
    }, null, 2));
    return;
  }

  if (cmd === "grant") {
    const ttlSec = Math.max(1, Number(opts["ttl-sec"] || 300));
    const ttlMs = ttlSec * 1000;
    const reason = String(opts.reason || "OWNER_CLI_GRANT");
    const agentIds = opts.agents
      ? String(opts.agents).split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const granted = ctrl.grantPrivilegeMode({ agentIds, ttlMs, reason });
    savePrivilegeState({
      active: true,
      agentIds,
      grantedAt: granted.audit.details.expiresAt - ttlMs,
      expiresAt: granted.expiresAt,
      reason
    });

    console.log(JSON.stringify({
      command: "grant",
      active: true,
      ttlSec,
      expiresAt: granted.expiresAt,
      agentScope: agentIds.length === 0 ? "ALL_IN_SCOPE" : agentIds,
      blackBoxSeq: granted.audit.seq,
      blackBoxHash: granted.audit.hash
    }, null, 2));
    return;
  }

  if (cmd === "revoke") {
    const reason = String(opts.reason || "OWNER_CLI_REVOKE");
    const revoked = ctrl.revokePrivilegeMode(reason);
    savePrivilegeState({
      active: false,
      agentIds: [],
      grantedAt: null,
      expiresAt: null,
      reason
    });

    console.log(JSON.stringify({
      command: "revoke",
      active: false,
      wasActive: revoked.wasActive,
      blackBoxSeq: revoked.audit.seq,
      blackBoxHash: revoked.audit.hash
    }, null, 2));
    return;
  }

  if (cmd === "verify-ledger") {
    const result = ctrl.verifyLedger();
    console.log(JSON.stringify({
      command: "verify-ledger",
      ledgerPath: ctrl.ledgerPath,
      ...result
    }, null, 2));
    if (!result.valid) process.exitCode = 1;
    return;
  }

  if (cmd === "mission") {
    await cmdMission(ctrl, opts);
    return;
  }

  console.error(`UNKNOWN_COMMAND:${cmd}`);
  printHelp();
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
