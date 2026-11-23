const fs = require("fs");
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

function log(msg) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
}

const wslListRaw = runSafe("wsl.exe -l -q") || runSafe("wsl -l -q") || "";
const distros = wslListRaw
  .split(/\r?\n/)
  .map((s) => s.replace(/\0/g, "").trim())
  .filter(Boolean);

const hasUbuntu = distros.some((d) => d.toLowerCase().includes("ubuntu"));
const hasKali = distros.some((d) => d.toLowerCase().includes("kali"));
const kaliVersion = hasKali ? runSafe("wsl.exe -d kali-linux -- uname -a") || runSafe("wsl -d kali-linux -- uname -a") || "Kali WSL active" : "Not detected";
const termuxAvailable = Boolean(process.env.TERMUX_VERSION || fs.existsSync("/data/data/com.termux"));

const payload = {
  updatedAt: new Date().toISOString(),
  connection: "LOCAL",
  targets: {
    wsl: {
      status: distros.length > 0 ? "CONNECTED" : "STANDBY",
      distros,
      ubuntu: hasUbuntu ? "CONNECTED" : "STANDBY",
      kaliWsl: hasKali ? "CONNECTED" : "STANDBY"
    },
    kaliLinux: {
      status: hasKali ? "CONNECTED" : "LAB-READY",
      details: kaliVersion
    },
    termux: {
      status: termuxAvailable ? "CONNECTED" : "STANDBY / ADB-OR-SSH",
      note: "Use public/downloads/MARAUDER-AI-Termux.sh on Android"
    }
  }
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));
log(`ENV_SYNC distros=${distros.join(",")} kali=${hasKali} termux=${termuxAvailable}`);
console.log(JSON.stringify(payload, null, 2));
