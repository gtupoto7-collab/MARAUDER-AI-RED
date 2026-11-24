const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const REG_PATH = path.join(__dirname, "..", "data", "tool-registry.json");

function loadToolRegistry() {
  if (!fs.existsSync(REG_PATH)) {
    return { version: "1.0.0", environmentTargets: [], tools: [] };
  }
  return JSON.parse(fs.readFileSync(REG_PATH, "utf8"));
}

function checkBinaryAvailable(binaryName) {
  const safeBin = String(binaryName || "").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safeBin) return { binary: binaryName, installed: false, version: null };
  try {
    execFileSync("which", [safeBin], { stdio: "ignore" });
    let version = "installed";
    try {
      const out = execFileSync(safeBin, ["--version"], { stdio: ["ignore", "pipe", "ignore"], timeout: 1500 }).toString().trim();
      if (out) version = out.split("\n")[0].slice(0, 90);
    } catch {}
    return { binary: safeBin, installed: true, version };
  } catch {
    return { binary: safeBin, installed: false, version: null };
  }
}

module.exports = { loadToolRegistry, checkBinaryAvailable };
