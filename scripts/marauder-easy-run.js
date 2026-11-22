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


function syncGitStatusAndOptionalCommit() {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: ROOT, stdio: "pipe" });
  } catch (_) {
    return { initialized: false, reason: "NOT_A_GIT_REPO" };
  }

  let dirtyBefore = "";
  try {
    dirtyBefore = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, stdio: "pipe" }).toString("utf8").trim();
  } catch (err) {
    return { initialized: true, error: err.message };
  }

  if (process.env.GIT_AUTO_COMMIT === "1" && dirtyBefore) {
    execFileSync("git", ["add", ".gitignore", "modules/", "routes/", "scripts/"], { cwd: ROOT, stdio: "pipe" });
    const staged = execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: ROOT, stdio: "pipe" }).toString("utf8").trim();
    if (staged) {
      const msg = process.env.GIT_COMMIT_MSG || `chore(marauder): auto-snapshot ${new Date().toISOString().slice(0, 19)}`;
      execFileSync("git", ["commit", "-m", msg], { cwd: ROOT, stdio: "pipe" });
    }
  }

  const head = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, stdio: "pipe" }).toString("utf8").trim();
  const dirtyAfter = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, stdio: "pipe" }).toString("utf8").trim();
  return {
    initialized: true,
    head,
    clean: dirtyAfter.length === 0,
    changedCount: dirtyAfter ? dirtyAfter.split("\n").length : 0
  };
}

(async () => {
  const syntax = checkAllSyntax();
  const port9050 = await checkPort9050();
  const shieldApi = await checkShieldApi();
  const e2eeSmoke = await runSecretChatE2eeSmokeTest();
  const sdSync = syncToSdAdditions();
  const git = syncGitStatusAndOptionalCommit();

  console.log(JSON.stringify({
    ok: syntax.ok && e2eeSmoke.ok,
    syntax,
    networkCheck: { port_127_0_0_1_9050: port9050, shieldEndpoint: shieldApi },
    secretChatE2eeSmoke: e2eeSmoke,
    sdSync,
    git
  }, null, 2));
})();


<div id="marauder-full-account-wallet-chat" style="margin-top:14px;padding:12px;border:1px solid #38bdf8;border-radius:10px;background:#0b111d;">
  <div style="font-weight:700;margin-bottom:8px;color:#7dd3fc;">MARAUDER-AI Hub: Registraciya, Realen Crypto Portofeil (Keeper / TON) i Plashtaniya</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;">
    <div style="padding:8px;border:1px solid #1e293b;border-radius:8px;">
      <div style="font-weight:700;margin-bottom:4px;">Registraciya / Profil</div>
      <input id="mah-user" type="text" placeholder="Ime ili alias (napr. ADMIRALERROR)" style="width:100%;box-sizing:border-box;margin-bottom:6px;" />
      <input id="mah-email" type="email" placeholder="Imeil za profil / izvestiya" style="width:100%;box-sizing:border-box;margin-bottom:6px;" />
      <button type="button" id="mah-save-user">Zapazi Registraciya</button>
      <div id="mah-user-status" style="margin-top:6px;font-size:12px;color:#4ade80;">Profil: ne e zapazen</div>
    </div>
    <div style="padding:8px;border:1px solid #1e293b;border-radius:8px;">
      <div style="font-weight:700;margin-bottom:4px;">Realen Crypto Portofeil (TON / Keeper)</div>
      <input id="mah-ton-addr" type="text" value="UQBOxLg-Vq86U_y1oJyUFTmvn6tedptaPQ4d3CDUq4O2T_7H" style="width:100%;box-sizing:border-box;margin-bottom:6px;" />
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button type="button" id="mah-ton-bal">Realen Balans (TON)</button>
        <a href="https://www.paypal.com/ncp/payment/RPTDVVN5XA4XC" target="_blank" rel="noopener noreferrer"><button type="button">PayPal NCP</button></a>
      </div>
      <div id="mah-ton-out" style="margin-top:6px;font-size:12px;color:#38bdf8;">Non-custodial: chete realen balans ot TON</div>
    </div>
  </div>
  <div style="margin-top:10px;padding:8px;border:1px solid #1e293b;border-radius:8px;">
    <div style="font-weight:700;margin-bottom:4px;">Jiv Chat / Sekretno Tablo (raboteshto)</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;">
      <input id="mah-chat-input" type="text" placeholder="Napishi syobshtenie ili komanda..." style="flex:1;min-width:180px;" />
      <button type="button" id="mah-chat-send">Izprati</button>
      <button type="button" id="mah-chat-clear">Izchisti</button>
    </div>
    <div id="mah-chat-feed" style="margin-top:8px;font-size:12px;max-height:170px;overflow:auto;"></div>
  </div>
</div>
<script id="MARAUDER_FULL_HUB_CHAT_JS">
(function(){
  const U_KEY = "marauder_hub_profile_v1";
  const C_KEY = "marauder_hub_chat_v1";
  function getChat(){ try { return JSON.parse(localStorage.getItem(C_KEY) || "[]"); } catch(_) { return []; } }
  function setChat(v){ try { localStorage.setItem(C_KEY, JSON.stringify(v.slice(0, 80))); } catch(_) {} }
  function renderChat(){
    const box = document.getElementById("mah-chat-feed");
    if (!box) return;
    const rows = getChat();
    if (!rows.length) { box.innerHTML = "<div style=\"opacity:.7\">Nqma syobshteniya oshte.</div>"; return; }
    box.innerHTML = rows.map(r => "<div style=\"padding:4px 0;border-bottom:1px solid #1e293b;\"><strong>" + r.who + ":</strong> " + r.msg + " <span style=\"opacity:.65\">(" + r.t + ")</span></div>").join("");
  }
  function wire(){
    try {
      const saved = JSON.parse(localStorage.getItem(U_KEY) || "null");
      const st = document.getElementById("mah-user-status");
      if (saved && st) st.textContent = "Registriran: " + (saved.user || "User") + " (" + (saved.email || "bez imeil") + ")";
    } catch(_) {}
    renderChat();

    const saveU = document.getElementById("mah-save-user");
    if (saveU) saveU.addEventListener("click", () => {
      const user = ((document.getElementById("mah-user")||{}).value || "ADMIRALERROR").trim();
      const email = ((document.getElementById("mah-email")||{}).value || "").trim();
      try { localStorage.setItem(U_KEY, JSON.stringify({ user, email })); } catch(_) {}
      const st = document.getElementById("mah-user-status");
      if (st) st.textContent = "Registriran: " + user + " (" + (email || "bez imeil") + ")";
    });

    const tonBtn = document.getElementById("mah-ton-bal");
    if (tonBtn) tonBtn.addEventListener("click", async () => {
      const addr = ((document.getElementById("mah-ton-addr")||{}).value || "").trim();
      const out = document.getElementById("mah-ton-out");
      if (!addr) return;
      if (out) out.textContent = "Proveryavam TON balans...";
      try {
        const r = await fetch("https://toncenter.com/api/v2/getAddressInformation?address=" + encodeURIComponent(addr));
        const j = await r.json();
        const ton = Number((j && j.result && j.result.balance) || 0) / 1e9;
        if (out) out.textContent = "TON Balans: " + ton.toFixed(4) + " TON (" + addr.slice(0, 8) + "...)";
      } catch(e) {
        if (out) out.textContent = "Greshka pri chetene ot TON: " + (e && e.message || "network");
      }
    });

    const sendBtn = document.getElementById("mah-chat-send");
    const inp = document.getElementById("mah-chat-input");
    function pushMsg(){
      const msg = ((inp && inp.value) || "").trim();
      if (!msg) return;
      const rows = getChat();
      rows.unshift({ who: "MARAUDER", msg, t: new Date().toLocaleTimeString() });
      setChat(rows);
      if (inp) inp.value = "";
      renderChat();
    }
    if (sendBtn) sendBtn.addEventListener("click", pushMsg);
    if (inp) inp.addEventListener("keydown", (e) => { if (e.key === "Enter") pushMsg(); });

    const clrBtn = document.getElementById("mah-chat-clear");
    if (clrBtn) clrBtn.addEventListener("click", () => { setChat([]); renderChat(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();
})();
</script>
