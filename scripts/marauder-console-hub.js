"use strict";

const os = require("os");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const rootDir = path.join(__dirname, "..");
const cmdArg = (process.argv[2] || "status").toLowerCase();

function detectConsoleEnvironment() {
  const isTermux = Boolean(process.env.TERMUX_VERSION) || (process.env.PREFIX || "").includes("com.termux");
  const isWsl = fs.existsSync("/proc/version") && /microsoft|wsl/i.test(fs.readFileSync("/proc/version", "utf8"));
  const platform = os.platform();
  const consoles = ["linux-shell", "wsl"];
  if (isTermux || platform === "android") consoles.push("termux");
  if (platform === "win32" || isWsl) consoles.push("windows-powershell", "windows-cmd");
  return { platform, isWsl, isTermux, availableConsoles: consoles };
}

function runCommand(bin, args, cwd = rootDir) {
  return new Promise((resolve) => {
    const child = spawn(bin, args, { cwd, stdio: "inherit" });
    child.on("close", (code) => resolve(code || 0));
    child.on("error", (err) => {
      console.error("[CONSOLE-HUB] Error:", err.message);
      resolve(1);
    });
  });
}

async function main() {
  const envInfo = detectConsoleEnvironment();
  console.log("[MARAUDER-CONSOLE-HUB]", JSON.stringify(envInfo));

  if (cmdArg === "status") {
    if (fs.existsSync(path.join(rootDir, "modules", "tor-socks5-verifier.js"))) {
      const { probeSocks5 } = require("../modules/tor-socks5-verifier");
      const tor = await probeSocks5();
      console.log("[TOR-SOCKS5]", JSON.stringify(tor));
    }
    if (fs.existsSync(path.join(rootDir, "modules", "audit-pages-runner.js"))) {
      const { auditProject } = require("../modules/audit-pages-runner");
      const aud = auditProject(rootDir);
      console.log("[AUDIT-SUMMARY] routesCount=" + aud.routesCount + " pages=" + Object.keys(aud.pages).length);
    }
    return;
  }

  if (cmdArg === "start" || cmdArg === "server") {
    const srv = path.join(rootDir, "server.js");
    if (fs.existsSync(srv)) {
      await runCommand(process.execPath, [srv]);
    } else {
      console.log("[CONSOLE-HUB] server.js not found in", rootDir);
    }
    return;
  }

  console.log("Usage: node scripts/marauder-console-hub.js <status|start>");
}

main();
