const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
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
