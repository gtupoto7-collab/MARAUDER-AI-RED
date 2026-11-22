"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const net = require("net");
const { execFileSync } = require("child_process");

const ROOT = process.cwd();
const SD_ROOT = process.env.SD_TARGET || "/mnt/d/MARAUDER-AI";
const SERVER_URL = process.env.MARAUDER_URL || "http://127.0.0.1:3000";

function walkJsFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "locked-core") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

function checkSyntaxAll() {
  const targets = [
    ...walkJsFiles(path.join(ROOT, "modules")),
    ...walkJsFiles(path.join(ROOT, "routes")),
    ...walkJsFiles(path.join(ROOT, "scripts"))
  ];
  const checked = [];
  for (const file of targets) {
    execFileSync("node", ["--check", file], { stdio: "pipe" });
    checked.push(path.relative(ROOT, file));
  }
  return { ok: true, count: checked.length, files: checked };
}

function probeSocks5(host = "127.0.0.1", port = 9050, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const sock = net.connect(port, host);
    let settled = false;
    const done = (result) => {
      if (settled) return;
      settled = true;
      try { sock.destroy(); } catch (_) {}
      resolve(result);
    };
    sock.setTimeout(timeoutMs);
    sock.on("connect", () => {
      sock.write(Buffer.from([0x05, 0x01, 0x00]));
    });
    sock.on("data", (buf) => {
      done({ open: true, socks5ReplyHex: buf.toString("hex") });
    });
    sock.on("timeout", () => done({ open: false, reason: "TIMEOUT" }));
    sock.on("error", (err) => done({ open: false, reason: err.code || err.message }));
  });
}

async function checkShieldEndpoint() {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${SERVER_URL}/api/shield/status`, { signal: controller.signal });
    clearTimeout(t);
    const text = await res.text();
    return { reachable: true, status: res.status, bodyPreview: text.slice(0, 300) };
  } catch (err) {
    return { reachable: false, reason: err.message || "UNREACHABLE" };
  }
}

function sha256File(filePath) {
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(filePath));
  return h.digest("hex");
}

function syncReleaseManifest() {
  const candidates = [
    { platform: "windows", rel: "releases/MARAUDER-AI.exe" },
    { platform: "android", rel: "releases/marauder-ai-android.apk" },
    { platform: "ios", rel: "releases/marauder-ai-ios.ipa" }
  ];
  const artifacts = candidates.map((c) => {
    const full = path.join(ROOT, c.rel);
    if (fs.existsSync(full)) {
      const st = fs.statSync(full);
      return {
        platform: c.platform,
        path: c.rel,
        exists: true,
        sizeBytes: st.size,
        sha256: sha256File(full)
      };
    }
    return {
      platform: c.platform,
      path: c.rel,
      exists: false,
      fallback: "MANIFEST_ONLY_PENDING_ARTIFACT"
    };
  });

  const manifest = {
    updatedAt: new Date().toISOString(),
    artifacts
  };
  const outPath = path.join(ROOT, "release-manifest.json");
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  return { outPath: "release-manifest.json", artifacts };
}

function rotateLogs(maxBytes = 256 * 1024) {
  const logDir = path.join(ROOT, "logs");
  if (!fs.existsSync(logDir)) return { trimmed: [] };
  const trimmed = [];
  for (const name of fs.readdirSync(logDir)) {
    const p = path.join(logDir, name);
    const st = fs.statSync(p);
    if (st.isFile() && st.size > maxBytes) {
      const raw = fs.readFileSync(p);
      fs.writeFileSync(p, raw.subarray(raw.length - maxBytes));
      trimmed.push({ file: name, beforeBytes: st.size, afterBytes: maxBytes });
    }
  }
  return { trimmed };
}

function syncAdditionsToSd() {
  const sdExists = fs.existsSync(SD_ROOT);
  const upgradeScript = path.join(ROOT, "scripts", "sd-add-upgrade.js");
  if (!sdExists || !fs.existsSync(upgradeScript)) {
    return { synced: false, reason: !sdExists ? "SD_NOT_MOUNTED" : "SD_UPGRADE_SCRIPT_MISSING", sdRoot: SD_ROOT };
  }

  const toSync = [
    "modules/e2ee-crypto-engine.js",
    "modules/red-secret-chat-button.js",
    "modules/hard-privacy-mode.js",
    "modules/hardening-guard.js",
    "modules/shield-stack-combo.js",
    "routes/red-secret-chat.js",
    "scripts/marauder-unified-bg.js",
    "scripts/marauder-auto-all.js"
  ].filter((rel) => fs.existsSync(path.join(ROOT, rel)));

  const syncedFiles = [];
  for (const rel of toSync) {
    execFileSync("node", [upgradeScript], {
      cwd: ROOT,
      stdio: "pipe",
      env: {
        ...process.env,
        SD_TARGET: SD_ROOT,
        ADD_TYPE: "module",
        ADD_NAME: path.basename(rel),
        ADD_SRC: path.join(ROOT, rel)
      }
    });
    syncedFiles.push(rel);
  }
  try { execFileSync("sync", { stdio: "pipe" }); } catch (_) {}
  return { synced: true, sdRoot: SD_ROOT, count: syncedFiles.length, syncedFiles };
}

(async () => {
  const syntax = checkSyntaxAll();
  const socks5 = await probeSocks5("127.0.0.1", 9050);
  const shield = await checkShieldEndpoint();
  const manifest = syncReleaseManifest();
  const logs = rotateLogs();
  const sd = syncAdditionsToSd();

  console.log(JSON.stringify({
    ok: true,
    syntax,
    doctor: { socks5_127_0_0_1_9050: socks5, shieldEndpoint: shield },
    manifest,
    logs,
    sd
  }, null, 2));
})();
