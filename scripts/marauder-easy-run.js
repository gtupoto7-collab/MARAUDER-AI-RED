"use strict";

const fs = require("fs");
const path = require("path");
const net = require("net");
const { execFileSync } = require("child_process");

const ROOT = process.cwd();
const SD_ROOT = process.env.SD_TARGET || "/mnt/d/MARAUDER-AI";
const SERVER_URL = process.env.MARAUDER_URL || "http://127.0.0.1:3000";

function checkAllSyntax() {
  const dirs = ["modules", "routes", "scripts"].map((d) => path.join(ROOT, d)).filter((p) => fs.existsSync(p));
  const files = [];
  for (const dir of dirs) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".js")) {
        const full = path.join(dir, entry.name);
        execFileSync("node", ["--check", full], { stdio: "pipe" });
        files.push(path.relative(ROOT, full));
      }
    }
  }
  return { ok: true, checkedCount: files.length, files };
}

function checkPort9050(host = "127.0.0.1", port = 9050, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const s = net.connect(port, host);
    let doneFlag = false;
    const finish = (val) => {
      if (doneFlag) return;
      doneFlag = true;
      try { s.destroy(); } catch (_) {}
      resolve(val);
    };
    s.setTimeout(timeoutMs);
    s.on("connect", () => s.write(Buffer.from([0x05, 0x01, 0x00])));
    s.on("data", (buf) => finish({ listening: true, socks5Reply: buf.toString("hex") }));
    s.on("timeout", () => finish({ listening: false, reason: "TIMEOUT" }));
    s.on("error", (err) => finish({ listening: false, reason: err.code || err.message }));
  });
}

async function checkShieldApi() {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 1200);
    const res = await fetch(`${SERVER_URL}/api/shield/status`, { signal: ac.signal });
    clearTimeout(timer);
    return { reachable: true, status: res.status };
  } catch (err) {
    return { reachable: false, reason: err.code || err.message || "OFFLINE" };
  }
}

async function runSecretChatE2eeSmokeTest() {
  const { generateEcdhKeyPair, deriveRoomAesKey, encryptMessage, decryptMessage } = require("../modules/e2ee-crypto-engine");
  const { createRedSecretChatRouter } = require("../routes/red-secret-chat");

  const alice = await generateEcdhKeyPair();
  const bob = await generateEcdhKeyPair();
  const router = createRedSecretChatRouter();

  let lastStatus = 0;
  let lastBody = "";
  const mockRes = {
    setHeader() {},
    writeHead(st) { lastStatus = st; },
    end(b) { lastBody = b; }
  };

  router.handleRequest({ method: "POST", url: "/api/secret-chat/create" }, mockRes, "/api/secret-chat/create", {
    maxMembers: 1000,
    messageLifetimeMs: 60_000,
    adminPublicJwk: alice.publicJwk,
    ip: "1.2.3.4",
    gps: "42.6,23.0"
  });
  const room = JSON.parse(lastBody);

  router.handleRequest({ method: "POST", url: "/api/secret-chat/join" }, mockRes, "/api/secret-chat/join", {
    code: room.invite.code,
    token: room.invite.token,
    memberPublicJwk: bob.publicJwk
  });
  const joined = JSON.parse(lastBody);

  const key = await deriveRoomAesKey(alice.keyPair.privateKey, alice.publicJwk, room.roomSaltB64, 1);
  const cipherObj = await encryptMessage(key, "AUTO RED SECRET CHAT TEST", `room:${room.roomId}:epoch:1`);

  // Verify server rejects plaintext
  router.handleRequest({ method: "POST", url: "/api/secret-chat/message" }, mockRes, "/api/secret-chat/message", {
    roomId: room.roomId,
    plaintext: "should fail"
  });
  const plaintextRejected = lastStatus === 400;

  // Send ciphertext + iv
  router.handleRequest({ method: "POST", url: "/api/secret-chat/message" }, mockRes, "/api/secret-chat/message", {
    roomId: room.roomId,
    senderId: "alice",
    iv: cipherObj.iv,
    ciphertext: cipherObj.ciphertext,
    keyEpoch: 1
  });
  const msgStored = lastStatus === 201;

  // Read state and decrypt locally
  router.handleRequest({ method: "GET", url: `/api/secret-chat/state?roomId=${room.roomId}` }, mockRes, "/api/secret-chat/state", null);
  const state = JSON.parse(lastBody);
  const decrypted = await decryptMessage(key, state.messages[0].iv, state.messages[0].ciphertext, `room:${room.roomId}:epoch:1`);

  return {
    ok: joined.ok && plaintextRejected && msgStored && decrypted === "AUTO RED SECRET CHAT TEST",
    roomId: room.roomId,
    inviteCode: room.invite.code,
    maxMembersSupported: room.maxMembers,
    plaintextRejected,
    msgStored,
    decryptedMatch: decrypted === "AUTO RED SECRET CHAT TEST",
    strippedForbiddenFields: room.hardPrivacy ? room.hardPrivacy.strippedFromRequest : []
  };
}

function syncToSdAdditions() {
  const upgrade = path.join(ROOT, "scripts", "sd-add-upgrade.js");
  if (!fs.existsSync(SD_ROOT) || !fs.existsSync(upgrade)) {
    return { synced: false, reason: "SD_OR_SCRIPT_MISSING", sdRoot: SD_ROOT };
  }
  const targets = [
    "modules/e2ee-crypto-engine.js",
    "modules/red-secret-chat-button.js",
    "modules/hard-privacy-mode.js",
    "modules/hardening-guard.js",
    "modules/shield-stack-combo.js",
    "routes/red-secret-chat.js",
    "scripts/marauder-easy-run.js"
  ].filter((rel) => fs.existsSync(path.join(ROOT, rel)));

  for (const rel of targets) {
    execFileSync("node", [upgrade], {
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
  }
  try { execFileSync("sync", { stdio: "pipe" }); } catch (_) {}
  return { synced: true, sdRoot: SD_ROOT, count: targets.length, files: targets };
}

(async () => {
  const syntax = checkAllSyntax();
  const port9050 = await checkPort9050();
  const shieldApi = await checkShieldApi();
  const e2eeSmoke = await runSecretChatE2eeSmokeTest();
  const sdSync = syncToSdAdditions();

  console.log(JSON.stringify({
    ok: syntax.ok && e2eeSmoke.ok,
    syntax,
    networkCheck: { port_127_0_0_1_9050: port9050, shieldEndpoint: shieldApi },
    secretChatE2eeSmoke: e2eeSmoke,
    sdSync
  }, null, 2));
})();
