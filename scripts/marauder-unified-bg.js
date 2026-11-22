"use strict";

const fs = require("fs");
const path = require("path");
const net = require("net");
const { spawn, execFileSync } = require("child_process");

const rootDir = path.join(__dirname, "..");
const logDir = path.join(rootDir, "logs");
const pidFile = path.join(logDir, "marauder-bg.pid");
const outLog = path.join(logDir, "marauder-bg.log");
const errLog = path.join(logDir, "marauder-bg.err.log");

const torHost = process.env.TOR_HOST || "127.0.0.1";
const torPort = Number(process.env.TOR_SOCKS_PORT || 9050);
const enforced = process.env.MARAUDER_SHIELD_ENFORCED === "1";
const targetPlatform = (process.env.MARAUDER_TARGET_PLATFORM || "auto").toLowerCase();

fs.mkdirSync(logDir, { recursive: true });

function checkSocks5(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const s = new net.Socket();
    let done = false;
    const finish = (ok, info) => {
      if (done) return;
      done = true;
      s.destroy();
      resolve({ ok, info });
    };
    s.setTimeout(timeoutMs);
    s.once("error", (e) => finish(false, e.code || e.message));
    s.once("timeout", () => finish(false, "TIMEOUT"));
    s.connect(port, host, () => s.write(Buffer.from([0x05, 0x01, 0x00])));
    s.once("data", (buf) => {
      if (buf && buf.length >= 2 && buf[0] === 0x05 && buf[1] !== 0xff) finish(true, "SOCKS5_OK");
      else finish(false, "BAD_REPLY");
    });
  });
}

function getProtonWindowsStatus() {
  try {
    const out = execFileSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "$p = Get-Process -Name 'ProtonVPN*' -ErrorAction SilentlyContinue; " +
        "$a = Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq 'Up' -and ($_.Name -match 'Proton|WireGuard|TAP|Wintun') }; " +
        "if ($p -or $a) { 'PROTON_VPN_WINDOWS_ACTIVE' } else { 'PROTON_VPN_WINDOWS_NOT_DETECTED' }"
      ],
      { encoding: "utf8", timeout: 10000 }
    ).trim();
    return out.split(/\r?\n/).pop() || "PROTON_VPN_WINDOWS_UNKNOWN";
  } catch (_) {
    return "PROTON_VPN_WINDOWS_CHECK_SKIPPED";
  }
}


function getWindscribeWindowsStatus() {
try {
const out = execFileSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-Command",
    "$w = Get-Process -Name "Windscribe*" -ErrorAction SilentlyContinue; " +
    "$a = Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq "Up" -and ($_.Name -match "Windscribe|Wintun|WireGuard|TAP") }; " +
    "if ($w -or $a) { "WINDSCRIBE_WINDOWS_ACTIVE" } else { "WINDSCRIBE_WINDOWS_NOT_DETECTED" }"
  ],
  { encoding: "utf8", timeout: 10000 }
).trim();
return out.split(/\r?\n/).pop() || "WINDSCRIBE_WINDOWS_UNKNOWN";
} catch (_) {
return "WINDSCRIBE_WINDOWS_CHECK_SKIPPED";
}
}

function startMarauderBackground() {
  if (fs.existsSync(pidFile)) {
    const oldPid = Number(fs.readFileSync(pidFile, "utf8").trim());
    if (oldPid > 0) {
      try {
        process.kill(oldPid, 0);
        return { started: false, pid: oldPid, reason: "ALREADY_RUNNING" };
      } catch (_) {}
    }
  }

  const srvPath = path.join(rootDir, "server.js");
  if (!fs.existsSync(srvPath)) {
    return { started: false, pid: null, reason: "SERVER_JS_MISSING" };
  }

  const outFd = fs.openSync(outLog, "a");
  const errFd = fs.openSync(errLog, "a");

  const child = spawn(process.execPath, [srvPath], {
    cwd: rootDir,
    detached: true,
    stdio: ["ignore", outFd, errFd],
    env: {
      ...process.env,
      MARAUDER_SHIELD_ENFORCED: enforced ? "1" : (process.env.MARAUDER_SHIELD_ENFORCED || "0"),
      TOR_HOST: torHost,
      TOR_SOCKS_PORT: String(torPort)
    }
  });

  child.unref();
  fs.writeFileSync(pidFile, String(child.pid), "utf8");
  return { started: true, pid: child.pid, reason: "STARTED_DETACHED" };
}

async function run() {
  const cmd = (process.argv[2] || "all").toLowerCase();
  const protonStatus = getProtonWindowsStatus();
  const windscribeStatus = getWindscribeWindowsStatus();
  const socksStatus = await checkSocks5(torHost, torPort);

  if (cmd === "stop") {
    if (fs.existsSync(pidFile)) {
      const pid = Number(fs.readFileSync(pidFile, "utf8").trim());
      try { process.kill(pid); } catch (_) {}
      try { fs.unlinkSync(pidFile); } catch (_) {}
      console.log("[UNIFIED-BG] Stopped PID:", pid);
    } else {
      console.log("[UNIFIED-BG] No PID file found.");
    }
    return;
  }

  const bg = (cmd === "status") ? { started: false, pid: null, reason: "STATUS_ONLY" } : startMarauderBackground();

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    targetPlatform,
    windowsVpn: { proton: protonStatus, windscribe: windscribeStatus },
    orbotTorSocks5: { endpoint: `${torHost}:${torPort}`, ...socksStatus },
    marauderBackground: bg,
    logs: { outLog, errLog }
  }, null, 2));
}

run();
