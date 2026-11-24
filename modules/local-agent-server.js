const http = require("http");
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");

const PORT = Number(process.env.MARAUDER_AGENT_PORT || 4789);
const HOST = "127.0.0.1";
const AGENT_TOKEN = process.env.MARAUDER_AGENT_TOKEN || "local-dev-token-change-me";

const ALLOWED_TOOLS = ["node", "npm", "python3", "git", "curl", "nmap", "nuclei", "ollama", "docker"];

function getLinuxRelease() {
  try {
    if (fs.existsSync("/etc/os-release")) {
      const raw = fs.readFileSync("/etc/os-release", "utf8");
      const pretty = raw.match(/PRETTY_NAME="([^"]+)"/);
      if (pretty && pretty[1]) return pretty[1];
    }
  } catch {}
  return `${os.type()} ${os.release()}`;
}

function inspectTools() {
  return ALLOWED_TOOLS.map((bin) => {
    try {
      execFileSync("which", [bin], { stdio: "ignore" });
      return { name: bin, installed: true };
    } catch {
      return { name: bin, installed: false };
    }
  });
}

function getTelemetry() {
  const totalMemMb = Math.round(os.totalmem() / (1024 * 1024));
  const freeMemMb = Math.round(os.freemem() / (1024 * 1024));
  const usedMemMb = totalMemMb - freeMemMb;
  const loadAvg = os.loadavg().map((n) => Number(n.toFixed(2)));
  const isWsl = Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP);

  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    environments: {
      "windows-host": { online: true, note: "Local bridge host (loopback only)" },
      "wsl": { online: isWsl, distro: process.env.WSL_DISTRO_NAME || "default" },
      "ubuntu": { online: /ubuntu/i.test(process.env.WSL_DISTRO_NAME || "") || /ubuntu/i.test(getLinuxRelease()) },
      "kali": { online: /kali/i.test(process.env.WSL_DISTRO_NAME || "") || /kali/i.test(getLinuxRelease()) },
      "termux": { online: false, note: "Connect via separate Termux agent endpoint" }
    },
    osVersion: getLinuxRelease(),
    hostname: os.hostname(),
    cpuCores: os.cpus().length,
    loadAvg,
    memoryMb: { total: totalMemMb, used: usedMemMb, free: freeMemMb },
    network: { interfaces: Object.keys(os.networkInterfaces()) },
    tools: inspectTools()
  };
}

function isAuthorized(req) {
  const auth = req.headers["x-marauder-token"] || "";
  return auth === AGENT_TOKEN;
}

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (!isAuthorized(req)) {
    res.writeHead(401);
    res.end(JSON.stringify({ ok: false, error: "Unauthorized: invalid or missing x-marauder-token" }));
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, service: "MARAUDER Local Agent", mode: "read-only", host: HOST, port: PORT }));
    return;
  }

  if (req.method === "GET" && req.url === "/telemetry") {
    res.writeHead(200);
    res.end(JSON.stringify(getTelemetry(), null, 2));
    return;
  }

  res.writeHead(403);
  res.end(JSON.stringify({ ok: false, error: "Forbidden by policy: endpoint not allowed in read-only mode" }));
});

server.listen(PORT, HOST, () => {
  console.log(`MARAUDER Local Agent listening on http://${HOST}:${PORT} (read-only)`);
});
