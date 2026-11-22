const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const projectRoot = path.join(__dirname, "..");
const sdRoot = process.env.SD_TARGET || "/mnt/d/MARAUDER-AI";

const dirs = [
  "locked-core",
  "additions/modules",
  "additions/upgrades",
  "additions/fixes",
  "tor-vpn-config",
  "backups"
];

for (const d of dirs) {
  fs.mkdirSync(path.join(sdRoot, d), { recursive: true });
}

function safeCopyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const data = fs.readFileSync(src);
  fs.writeFileSync(dest, data);
}

function safeCopyDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return 0;
  let count = 0;
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(srcDir, entry.name);
    const d = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      count += safeCopyDir(s, d);
    } else if (entry.isFile()) {
      safeCopyFile(s, d);
      count += 1;
    }
  }
  return count;
}

const lockFlag = path.join(sdRoot, "locked-core", "LOCKED.OK");
const lockCore = process.env.LOCK_CORE === "1" || !fs.existsSync(lockFlag);
let copiedCoreFiles = 0;

if (lockCore) {
  copiedCoreFiles += safeCopyDir(path.join(projectRoot, "public"), path.join(sdRoot, "locked-core", "public"));
  copiedCoreFiles += safeCopyDir(path.join(projectRoot, "scripts"), path.join(sdRoot, "locked-core", "scripts"));
  const coreManifest = {
    app: "MARAUDER-AI",
    lockedAt: new Date().toISOString(),
    filesCount: copiedCoreFiles,
    status: "LOCKED_WORKING_BASELINE"
  };
  fs.writeFileSync(path.join(sdRoot, "locked-core", "locked-core-manifest.json"), JSON.stringify(coreManifest, null, 2), "utf8");
  fs.writeFileSync(lockFlag, "LOCKED_AT=" + coreManifest.lockedAt + "\n", "utf8");
}

const torProfile = {
  app: "MARAUDER-AI",
  networkMode: "TOR_NONSTOP_LOCKED",
  socks5Endpoint: "127.0.0.1:9050",
  android: "Orbot selected app + Unrestricted battery",
  ios: "Orbot / Tor VPN profile active",
  windows: "Local tor.exe on 127.0.0.1:9050 with watchdog loop",
  updatedAt: new Date().toISOString()
};
fs.writeFileSync(path.join(sdRoot, "tor-vpn-config", "tor-vpn-locked.json"), JSON.stringify(torProfile, null, 2), "utf8");

const addType = process.env.ADD_TYPE || "";
const addName = (process.env.ADD_NAME || "").trim();
const addSrc = (process.env.ADD_SRC || "").trim();

const registryPath = path.join(sdRoot, "addons-registry.json");
let registry = { items: [] };
if (fs.existsSync(registryPath)) {
  try { registry = JSON.parse(fs.readFileSync(registryPath, "utf8")); } catch (_) {}
}
if (!Array.isArray(registry.items)) registry.items = [];

if (addType && addName && addSrc && fs.existsSync(addSrc)) {
  const folderMap = {
    module: "additions/modules",
    upgrade: "additions/upgrades",
    fix: "additions/fixes"
  };
  const sub = folderMap[addType] || "additions/modules";
  const targetPath = path.join(sdRoot, sub, addName);
  const stat = fs.statSync(addSrc);
  let itemFiles = 0;

  if (stat.isDirectory()) {
    itemFiles = safeCopyDir(addSrc, targetPath);
  } else {
    safeCopyFile(addSrc, targetPath);
    itemFiles = 1;
  }

  const hash = crypto.createHash("sha256").update(addName + ":" + new Date().toISOString()).digest("hex").slice(0, 12);
  registry.items.push({
    id: hash,
    type: addType,
    name: addName,
    target: path.join(sub, addName),
    files: itemFiles,
    addedAt: new Date().toISOString()
  });
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), "utf8");
  console.log("ADDED_ITEM -> " + addType + ":" + addName + " (" + itemFiles + " files)");
}

console.log("SD_LOCK_AND_ADD_READY -> " + sdRoot + " | coreFiles=" + copiedCoreFiles + " | totalAddons=" + registry.items.length);
