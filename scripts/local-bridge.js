const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");

const rootDir = path.join(__dirname, "..");
const outFile = path.join(rootDir, "public", "api", "local-hub.json");
const logFile = path.join(rootDir, "logs", "local-bridge.log");

function runSafe(cmd) {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"], timeout: 3000 }).toString().trim();
  } catch {
    return null;
  }
}

function audit(action, detail) {
  const line = `[${new Date().toISOString()}] ${action}: ${detail}\n`;
  fs.appendFileSync(logFile, line);
}

function collectHubState() {
  const wslListRaw = runSafe("wsl.exe -l -q") || runSafe("wsl -l -q") || "";
  const wslDistros = wslListRaw
    .split(/\r?\n/)
    .map((s) => s.replace(/\0/g, "").trim())
    .filter(Boolean);

  const hasUbuntu = wslDistros.some((d) => d.toLowerCase().includes("ubuntu"));
  const hasKali = wslDistros.some((d) => d.toLowerCase().includes("kali"));
  const dockerPs = runSafe("docker ps --format '{{.Names}}'");
  const dockerCount = dockerPs ? dockerPs.split(/\r?\n/).filter(Boolean).length : 0;

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedRamPct = Math.round(((totalMem - freeMem) / totalMem) * 100);
  const load1 = os.loadavg()[0] ? os.loadavg()[0].toFixed(2) : "0.00";

  const payload = {
    updatedAt: new Date().toISOString(),
    connection: "LOCAL",
    targets: {
      powershell: { status: "CONNECTED", mode: "local-host" },
      ubuntuWsl: { status: hasUbuntu ? "CONNECTED" : "STANDBY", distros: wslDistros },
      kaliLinux: { status: hasKali ? "CONNECTED" : "LAB-READY", lab: "KALI LAB CONTROL" },
      termux: { status: "OFFLINE", bridge: "android-ssh-or-termux-api" },
      docker: { status: dockerPs !== null ? "CONNECTED" : "OFFLINE", runningContainers: dockerCount }
    },
    system: {
      cpuLoad1m: load1,
      ramUsedPct: usedRamPct,
      linuxKernel: runSafe("uname -r") || os.release(),
      hostname: os.hostname()
    }
  };

  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
  audit("SYNC", `ubuntu=${hasUbuntu} kali=${hasKali} docker=${dockerCount} ram=${usedRamPct}%`);
}

audit("START", "MARAUDER LOCAL BRIDGE initialized");
collectHubState();
setInterval(collectHubState, 10000);
