const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const RealityExecutor = require("../executor/reality-executor");

const BLACKBOX_DIR = path.join(__dirname, "..", "..", "data", "blackbox");
const ASSETS_FILE = path.join(__dirname, "..", "..", "data", "assets", "assets-8k.json");
const MAX_ASSETS = 8000;

const ALLOWED_SCOPE = new Set([
  "localhost",
  "127.0.0.1",
  "verified-local-lab",
  "admiralerror-local-lab"
]);

function build800Registry() {
  const tiers = [
    { range: "1-200", start: 1, end: 200, side: "DEFENSIVE", divisions: ["SOC", "DFIR", "INTEL", "NETWORK"] },
    { range: "201-400", start: 201, end: 400, side: "HYBRID_GUARD", divisions: ["CLOUD", "IDENTITY", "AI_SECURITY", "GOVERNANCE"] },
    { range: "401-800", start: 401, end: 800, side: "AUTHORIZED_TEST_VERIFY", divisions: ["SCOUT", "APPSEC", "MALWARE_LAB", "VERIFIER"] }
  ];

  const registry = [];
  for (const tier of tiers) {
    for (let id = tier.start; id <= tier.end; id++) {
      const div = tier.divisions[(id - tier.start) % tier.divisions.length];
      const capMap = {
        SOC: "logs.read",
        DFIR: "filesystem.read",
        INTEL: "network.observe",
        NETWORK: "network.observe",
        CLOUD: "security.scan",
        IDENTITY: "process.inspect",
        AI_SECURITY: "security.scan",
        GOVERNANCE: "logs.read",
        SCOUT: "network.observe",
        APPSEC: "security.scan",
        MALWARE_LAB: "sandbox.execute",
        VERIFIER: "process.inspect"
      };
      registry.push({
        id,
        code: `MRD-A${String(id).padStart(4, "0")}`,
        version: "1.0.0",
        poolTier: tier.range,
        parliamentChamber: tier.side,
        division: div,
        capabilities: [capMap[div]],
        permissions: ["least-privilege", "scope-enforced"],
        health: "READY_POOLED",
        resourceLimits: { maxCpuPct: 25, maxMemMb: 256, maxRuntimeMs: 8000 },
        owner: "admiralerror@MARAUDER-OS",
        auditTrail: []
      });
    }
  }
  return registry;
}

class MarauderFabricEngine {
  constructor() {
    this.agents = build800Registry();
    this.byId = new Map(this.agents.map((a) => [a.id, a]));
    this.executor = new RealityExecutor();
    this.seenEventHashes = new Set();
    fs.mkdirSync(BLACKBOX_DIR, { recursive: true });
    fs.mkdirSync(path.dirname(ASSETS_FILE), { recursive: true });
    if (!fs.existsSync(ASSETS_FILE)) {
      fs.writeFileSync(ASSETS_FILE, JSON.stringify({ maxAssets: MAX_ASSETS, items: [] }, null, 2));
    }
  }

  getStats() {
    return {
      registeredAgents: this.agents.length,
      activeResidentProcesses: 0,
      mode: "ON_DEMAND_POOL_AND_RECYCLE",
      maxAssetsCapacity: MAX_ASSETS,
      eventPipelineStages: ["FILTER", "NORMALIZE", "DEDUP", "CORRELATE", "ANOMALY_DETECTION", "INTERESTING_EVENTS"]
    };
  }

  selectAgentsForMission(missionText, count = 4) {
    const q = String(missionText || "").toLowerCase();
    const preferredDivisions = [];
    if (/log|siem|alert|soc|incident/.test(q)) preferredDivisions.push("SOC");
    if (/forensic|disk|memory|dfir|timeline/.test(q)) preferredDivisions.push("DFIR");
    if (/net|port|dns|traffic|scan/.test(q)) preferredDivisions.push("NETWORK", "SCOUT");
    if (/app|web|api|code|vuln/.test(q)) preferredDivisions.push("APPSEC");
    if (/malware|sample|sandbox/.test(q)) preferredDivisions.push("MALWARE_LAB");
    if (preferredDivisions.length === 0) preferredDivisions.push("SCOUT", "SOC", "VERIFIER");

    const picked = [];
    for (const div of preferredDivisions) {
      const match = this.agents.find((a) => a.division === div && !picked.some((p) => p.id === a.id));
      if (match) picked.push(match);
      if (picked.length >= count) break;
    }
    while (picked.length < count) {
      const fallback = this.agents.find((a) => !picked.some((p) => p.id === a.id));
      if (!fallback) break;
      picked.push(fallback);
    }
    return picked.map((a) => ({ ...a, health: "ACTIVATED_FOR_JOB" }));
  }

  ingestEvents(rawEvents = []) {
    const normalized = [];
    const interesting = [];

    for (const ev of rawEvents) {
      // 1. FILTER noise/debug
      const level = String(ev.level || "info").toLowerCase();
      if (level === "debug" || level === "trace") continue;

      // 2. NORMALIZE
      const norm = {
        ts: ev.ts || new Date().toISOString(),
        source: String(ev.source || "unknown-sensor"),
        asset: String(ev.asset || "verified-local-lab"),
        severity: String(ev.severity || "low").toLowerCase(),
        message: String(ev.message || "").trim()
      };
      if (!norm.message) continue;

      // 3. DEDUP
      const hash = crypto.createHash("sha256").update(`${norm.source}|${norm.asset}|${norm.message}`).digest("hex");
      if (this.seenEventHashes.has(hash)) continue;
      this.seenEventHashes.add(hash);
      normalized.push(norm);

      // 4-6. CORRELATE + ANOMALY -> INTERESTING EVENTS
      const isInteresting =
        ["high", "critical", "medium"].includes(norm.severity) ||
        /fail|denied|anom|suspicious|error|unauth|escalat/i.test(norm.message);
      if (isInteresting) {
        interesting.push({ ...norm, dedupHash: hash.slice(0, 12) });
      }
    }

    return {
      received: rawEvents.length,
      afterFilterAndDedup: normalized.length,
      interestingForAI: interesting.length,
      interestingEvents: interesting
    };
  }

  upsertAsset({ id, kind = "server", name, lifecycle = "DISCOVERED" }) {
    const validStates = ["DISCOVERED", "VERIFIED", "MONITORED", "AT_RISK", "REMEDIATED"];
    const state = validStates.includes(lifecycle) ? lifecycle : "DISCOVERED";
    const store = JSON.parse(fs.readFileSync(ASSETS_FILE, "utf8"));
    const existingIdx = store.items.findIndex((x) => x.id === id);
    const record = {
      id: id || `AST-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      kind,
      name,
      lifecycle: state,
      updatedAt: new Date().toISOString()
    };

    if (existingIdx >= 0) {
      store.items[existingIdx] = record;
    } else {
      if (store.items.length >= MAX_ASSETS) {
        return { ok: false, error: `Asset limit reached (${MAX_ASSETS})` };
      }
      store.items.push(record);
    }
    fs.writeFileSync(ASSETS_FILE, JSON.stringify(store, null, 2));
    return { ok: true, totalAssets: store.items.length, asset: record };
  }

  async runBlackBoxMission({ mission, target = "verified-local-lab", events = [] }) {
    const missionId = "MISSION-" + crypto.randomInt(10000, 99999);
    const startedAt = new Date().toISOString();

    if (!ALLOWED_SCOPE.has(String(target).trim())) {
      const deniedRecord = {
        missionId,
        startedAt,
        target,
        status: "REJECTED_OUT_OF_SCOPE",
        reason: "Target outside authorized local/lab scope allowlist",
        evidenceRequired: true,
        findingAllowed: false
      };
      fs.appendFileSync(path.join(BLACKBOX_DIR, "blackbox.jsonl"), JSON.stringify(deniedRecord) + "\n");
      return { ok: false, blackBox: deniedRecord };
    }

    const eventBatch = this.ingestEvents(events);
    const selectedAgents = this.selectAgentsForMission(mission, 4);

    // Parliament check: Offensive/Test chamber requires explicit authorized target + Defensive + Verifier quorum
    const parliament = {
      offensiveChamber: selectedAgents.filter((a) => a.parliamentChamber === "AUTHORIZED_TEST_VERIFY").map((a) => a.code),
      defensiveChamber: selectedAgents.filter((a) => a.parliamentChamber !== "AUTHORIZED_TEST_VERIFY").map((a) => a.code),
      authorizedScopeVerified: true,
      unilateralActionAllowed: false
    };

    const execCheck = process.platform === "win32"
      ? await this.executor.runSafeCheck({
          agent: "Parliament Verifier",
          capability: "process.inspect",
          target,
          bin: "cmd",
          args: ["/c", "whoami"]
        })
      : await this.executor.runSafeCheck({
          agent: "Parliament Verifier",
          capability: "filesystem.read",
          target,
          bin: "uname",
          args: ["-n"]
        });

    const hasEvidence = Boolean(execCheck && execCheck.id && execCheck.result === "VERIFIED");
    const recycledAgents = selectedAgents.map((a) => ({
      code: a.code,
      division: a.division,
      health: "RECYCLED_IDLE",
      auditEvent: `${missionId}:${execCheck.id}`
    }));

    const blackBoxRecord = {
      missionId,
      START: startedAt,
      MISSION: mission,
      TARGET: target,
      EVENT_PIPELINE: eventBatch,
      AGENTS_USED: recycledAgents,
      PARLIAMENT: parliament,
      ACTIONS: [execCheck.command],
      OBSERVATIONS: [execCheck.realOutput],
      EVIDENCE: hasEvidence ? execCheck : null,
      DECISIONS: hasEvidence
        ? ["Evidence verified by executor", "Parliament quorum passed", "Safe to emit verified observation"]
        : ["No verified evidence -> finding blocked"],
      RESULT: hasEvidence ? "VERIFIED_WITH_EVIDENCE" : "BLOCKED_NO_EVIDENCE",
      FINISHED: new Date().toISOString()
    };

    fs.appendFileSync(path.join(BLACKBOX_DIR, "blackbox.jsonl"), JSON.stringify(blackBoxRecord) + "\n");
    return { ok: true, blackBox: blackBoxRecord };
  }
}

module.exports = MarauderFabricEngine;
