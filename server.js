const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const { AntiDroneDefenseEngine } = require("./modules/anti-drone-defense");
const defenseEngine = new AntiDroneDefenseEngine();
defenseEngine.ingestSensorFrame({ trackId: "UAS-01", freqMhz: 2450, rssiDbm: -58, distanceM: 420, speedKmh: 54, altitudeM: 90, swarmCount: 1 });
const path = require("path");
const { MarauderRootController, sha256 } = require("./modules/marauder-root-controller");
const { SynchroMeshOrchestrator } = require("./modules/synchro-mesh");

const ROOT_DIR = process.cwd();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

const controller = new MarauderRootController({ rootDir: ROOT_DIR });
const mesh = new SynchroMeshOrchestrator({ rootDir: ROOT_DIR, concurrency: 6, controller });

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        reject(new Error("BODY_TOO_LARGE"));
      }
    });
    req.on("end", () => {
      if (!data.trim()) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error("INVALID_JSON"));
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || "/").split("?")[0];

  if (req.method === "GET" && urlPath === "/api/agents/stats") {
    return sendJson(res, 200, controller.getRegistryStats());
  }

  if (req.method === "GET" && urlPath === "/api/ledger/status") {
    return sendJson(res, 200, controller.verifyLedger());
  }

  if (req.method === "POST" && urlPath === "/api/channel/handshake") {
    try {
      const body = await readBody(req);
      const key = String(body.key || "").trim();
      const password = String(body.password || "").trim();
      if (!key || !password) {
        return sendJson(res, 400, { connected: false, reason: "KEY_AND_PASSWORD_REQUIRED" });
      }
      const sessionId = `SES-${crypto.randomBytes(6).toString("hex")}`;
      const keyDigest = sha256(`${key}:${password}`);
      return sendJson(res, 200, {
        connected: true,
        sessionId,
        keyDigest,
        verifiedByBackend: true,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      return sendJson(res, 400, { connected: false, reason: err.message });
    }
  }

  if (req.method === "POST" && urlPath === "/api/missions/run") {
    try {
      const body = await readBody(req);
      const mode = ["DEFENSE", "RED_TEAM", "COMMAND"].includes(body.mode) ? body.mode : "DEFENSE";
      const count = Math.min(25, Math.max(1, Number(body.count || 4)));
      const missionId = String(body.missionId || `MISSION-${mode}-${Date.now()}`);

      const allIds = Array.from(controller.registryById.keys());
      const selectedIds = allIds.slice(0, count);

      const tasks = selectedIds.map((agentId, idx) => {
        const isRed = mode === "RED_TEAM";
        const capability = isRed ? "range:sim-validate" : "audit:file-hash";
        const scope = isRed ? "lab:isolated" : "project:files";
        const payload = { targetFile: "modules/marauder-root-controller.js", index: idx };
        const approvalId = isRed
          ? controller.issueOneTimeApproval({
              agentId,
              capability,
              scope,
              actionPayload: payload
            })
          : null;

        return {
          id: `STEP-${idx + 1}`,
          agentId,
          capability,
          scope,
          approvalId,
          payload,
          retries: 0,
          runner: ({ agent, graph }) => {
            const targetAbs = path.join(ROOT_DIR, "modules", "marauder-root-controller.js");
            const digest = fs.existsSync(targetAbs) ? sha256(fs.readFileSync(targetAbs)) : "MISSING";
            const nodeId = graph.upsertNode("FILE", "modules/marauder-root-controller.js", { sha256: digest }, agent.id);
            const modeNode = graph.upsertNode("MODE", mode, { missionId }, agent.id);
            graph.link(nodeId, modeNode, "EVALUATED_IN");
            return { agentId: agent.id, role: agent.role, mode, sha256: digest };
          }
        };
      });

      const report = await mesh.runMission(missionId, tasks);
      return sendJson(res, 200, {
        missionId: report.missionId,
        mode,
        completedCount: report.completedCount,
        failedCount: report.failedCount,
        missionDigest: report.missionDigest,
        ledger: report.ledger
      });
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }


function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) {
        reject(new Error("PAYLOAD_TOO_LARGE"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error("INVALID_JSON"));
      }
    });
    req.on("error", reject);
  });
}

function sendStatusJson(res, code, payload) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

const { SensorBusFusionEngine } = require("./modules/anti-drone/sensor-bus-fusion");
const marauderSensorFusion = new SensorBusFusionEngine();
marauderSensorFusion.ingestObservation({
  trackId: "BS-01",
  sensor: "RADAR",
  confidence: 0.85,
  distanceM: 260,
  speedKmh: 75,
  altitudeM: 60,
  zone: "BLACK_SEA_COAST"
});
marauderSensorFusion.ingestObservation({
  trackId: "BS-01",
  sensor: "EO_IR",
  confidence: 0.92,
  distanceM: 250,
  speedKmh: 74,
  altitudeM: 58,
  zone: "BLACK_SEA_COAST"
});

const { MarauderWarfareSimulator } = require("./modules/warfare/warfare-simulator");

function resolveMarauderRootController() {
  if (typeof globalThis.__MARAUDER_ROOT_CONTROLLER__ !== "undefined" && globalThis.__MARAUDER_ROOT_CONTROLLER__) {
    return globalThis.__MARAUDER_ROOT_CONTROLLER__;
  }
  try {
    const rootMod = require("./modules/marauder-root-controller");
    const Ctor = rootMod.MarauderRootController || rootMod.default || rootMod;
    if (typeof Ctor === "function") {
      const inst = new Ctor();
      globalThis.__MARAUDER_ROOT_CONTROLLER__ = inst;
      return inst;
    }
    if (rootMod && typeof rootMod.authorizeAndPrepare === "function") {
      return rootMod;
    }
  } catch (_) {}
  return null;
}

const marauderWarfareSim = new MarauderWarfareSimulator({
  rootController: resolveMarauderRootController(),
  blackbox: typeof blackbox !== "undefined" ? blackbox : null
});

function resolveMarauderCoreForRoute() {
  if (typeof globalThis.__MARAUDER_AI_CORE__ !== "undefined" && globalThis.__MARAUDER_AI_CORE__ && typeof globalThis.__MARAUDER_AI_CORE__.reasonWithGateway === "function") {
    return globalThis.__MARAUDER_AI_CORE__;
  }
  if (typeof marauderCore !== "undefined" && marauderCore && typeof marauderCore.reasonWithGateway === "function") {
    return marauderCore;
  }
  const { MarauderAICore, GatewayModelAdapter } = require("./modules/marauder-ai-core");
  const { MarauderModelGateway } = require("./modules/model-gateway");
  const gw = new MarauderModelGateway();
  const coreInst = new MarauderAICore({ modelAdapter: new GatewayModelAdapter({ gateway: gw }) });
  globalThis.__MARAUDER_AI_CORE__ = coreInst;
  return coreInst;
}

if (req.method === "GET" && urlPath === "/api/defense/fusion/status") {
  return sendStatusJson(res, 200, {
    ok: true,
    tracks: Array.from(marauderSensorFusion.tracks.values()).map((t) => ({
      ...t,
      sensors: Array.from(t.sensors)
    })),
    evidenceCount: marauderSensorFusion.evidenceLog.length,
    latestEvidence: marauderSensorFusion.evidenceLog[marauderSensorFusion.evidenceLog.length - 1] || null
  });
}

if (req.method === "POST" && urlPath === "/api/defense/fusion/ingest") {
  try {
    const body = await readJsonBody(req);
    const out = marauderSensorFusion.ingestObservation(body || {});
    if (!out.ok) return sendStatusJson(res, 400, out);
    return sendStatusJson(res, 200, out);
  } catch (err) {
    return sendStatusJson(res, 400, { ok: false, error: err.message });
  }
}

if (req.method === "GET" && urlPath === "/api/warfare/status") {
  return sendStatusJson(res, 200, {
    ok: true,
    version: marauderWarfareSim.version,
    simulationOnly: true,
    automaticWeaponsRelease: false,
    runsCount: marauderWarfareSim.history.length,
    proposalsCount: marauderWarfareSim.proposedAgents.length,
    latestRun: marauderWarfareSim.history[marauderWarfareSim.history.length - 1] || null
  });
}

if (req.method === "POST" && urlPath === "/api/warfare/run-scenario") {
  try {
    const body = await readJsonBody(req);
    const result = marauderWarfareSim.runScenario(body || {});
    return sendStatusJson(res, 200, { ok: true, simulation: result });
  } catch (err) {
    return sendStatusJson(res, 400, { ok: false, error: err.message });
  }
}

if (req.method === "POST" && urlPath === "/api/core/reason") {
  try {
    const body = await readJsonBody(req);
    const prompt = String(body.prompt || body.input || body.task || "").trim();
    if (!prompt) {
      return sendStatusJson(res, 400, {
        ok: false,
        error: "MISSING_PROMPT",
        usedModel: false,
        executionMode: "FALLBACK_NO_MODEL"
      });
    }

    const core = resolveMarauderCoreForRoute();
    const result = await core.reasonWithGateway({
      prompt,
      system: body.system,
      task: body.task || "api-reason",
      model: body.model,
      provider: body.provider,
      timeoutMs: body.timeoutMs,
      temperature: body.temperature
    });

    return sendStatusJson(res, 200, {
      ok: Boolean(result.ok),
      engine: result.engine || "MARAUDER-AI-CORE",
      usedModel: Boolean(result.usedModel),
      fallbackUsed: Boolean(result.fallbackUsed),
      executionMode: result.executionMode,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs || 0,
      fallbackReason: result.fallbackReason || null,
      task: result.task,
      output: result.output
    });
  } catch (err) {
    return sendStatusJson(res, 500, {
      ok: false,
      error: err && err.message ? err.message : "CORE_REASON_ERROR",
      usedModel: false,
      executionMode: "FALLBACK_NO_MODEL"
    });
  }
}

  // Статично обслужване на public/command-center.html по подразбиране
  const targetFile =
    urlPath === "/" || urlPath === "/command-center"
      ? path.join(PUBLIC_DIR, "command-center.html")
      : path.join(PUBLIC_DIR, urlPath);

  const resolved = path.resolve(targetFile);
  if (!resolved.startsWith(path.resolve(PUBLIC_DIR))) {
    res.writeHead(403);
    return res.end("FORBIDDEN");
  }

  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    const ext = path.extname(resolved).toLowerCase();
    const mime =
      ext === ".html"
        ? "text/html; charset=utf-8"
        : ext === ".js"
          ? "application/javascript; charset=utf-8"
          : ext === ".json"
            ? "application/json; charset=utf-8"
            : "application/octet-stream";
    res.writeHead(200, { "Content-Type": mime });
    return fs.createReadStream(resolved).pipe(res);
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("NOT_FOUND");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`MARAUDER_BACKEND_LISTENING on http://127.0.0.1:${PORT}`);
});


