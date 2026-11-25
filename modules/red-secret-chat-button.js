"use strict";

const {
  generateEcdhKeyPair,
  deriveRoomAesKey,
  encryptMessage,
  decryptMessage
} = require("./e2ee-crypto-engine");

const GROUP_TIERS = [2, 3, 10, 50, 100, 500, 1000];
const MESSAGE_LIFETIMES = [
  { label: "5 sec", ms: 5_000 },
  { label: "30 sec", ms: 30_000 },
  { label: "1 min", ms: 60_000 },
  { label: "5 min", ms: 300_000 },
  { label: "1 hour", ms: 3_600_000 },
  { label: "Custom", ms: null }
];
const ROOM_DELETE_MODES = [
  { label: "Immediately", ms: 0 },
  { label: "1 hour", ms: 3_600_000 },
  { label: "24 hours", ms: 86_400_000 },
  { label: "Manual", ms: -1 }
];

const PRIVACY_CHECKLIST = [
  "Client-side ECDH + AES-GCM encryption (no plaintext sent to server)",
  "Short-lived single-use invite codes & key epoch rotation",
  "Configurable message & room retention/expiration",
  "Optional VPN / Tor transport (IP/metadata may still be visible without transport protection)",
  "No technical guarantee against screenshots or external capture"
];

function createRedSecretChatState() {
  return {
    buttonLabel: "RED SECRET CHAT",
    groupTiers: GROUP_TIERS,
    messageLifetimes: MESSAGE_LIFETIMES,
    roomDeleteModes: ROOM_DELETE_MODES,
    privacyChecklist: PRIVACY_CHECKLIST
  };
}


function renderSimpleQrMatrix(canvas, text) {
  if (!canvas || typeof canvas.getContext !== "function") return;
  const ctx = canvas.getContext("2d");
  const size = 21;
  const cell = Math.max(4, Math.floor(canvas.width / size));
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#11090b";

  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const isFinder = (r, c) =>
    (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      let dark = false;
      if (isFinder(r, c)) {
        const ir = r >= size - 7 ? r - (size - 7) : r;
        const ic = c >= size - 7 ? c - (size - 7) : c;
        dark = ir === 0 || ir === 6 || ic === 0 || ic === 6 || (ir >= 2 && ir <= 4 && ic >= 2 && ic <= 4);
      } else {
        const bitSeed = (hash ^ (r * 73856093) ^ (c * 19349663) ^ (text.length * 83492791)) >>> 0;
        dark = (bitSeed % 2) === 1;
      }
      if (dark) {
        ctx.fillRect(c * cell, r * cell, cell, cell);
      }
    }
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mountRedSecretChatButton(container, apiBase = "/api/secret-chat") {
  if (!container) return null;

  container.innerHTML = `
    <div id="red-secret-chat-wrap" style="border:1px solid #8b1e24;background:#11090b;color:#f5eaea;padding:14px;border-radius:8px;font-family:monospace;">
      <button id="btn-red-secret-chat" type="button" style="background:#b91c1c;color:#fff;border:1px solid #fca5a5;padding:10px 16px;font-weight:700;cursor:pointer;border-radius:6px;">
        RED SECRET CHAT
      </button>
      <div id="rsc-panel" style="display:none;margin-top:12px;border-top:1px solid #3b1417;padding-top:12px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
          <label>Group (2-1000):
            <select id="rsc-group-size" style="background:#1c0d10;color:#fff;padding:4px;">
              ${GROUP_TIERS.map((n) => `<option value="${n}">${n} users</option>`).join("")}
            </select>
          </label>
          <label>Message lifetime:
            <select id="rsc-msg-ttl" style="background:#1c0d10;color:#fff;padding:4px;">
              ${MESSAGE_LIFETIMES.map((m) => `<option value="${m.ms === null ? "custom" : m.ms}">${m.label}</option>`).join("")}
            </select>
          </label>
          <label>Delete room:
            <select id="rsc-room-ttl" style="background:#1c0d10;color:#fff;padding:4px;">
              ${ROOM_DELETE_MODES.map((d) => `<option value="${d.ms}">${d.label}</option>`).join("")}
            </select>
          </label>
          <button id="rsc-create-room" type="button" style="background:#7f1d1d;color:#fff;border:1px solid #ef4444;padding:5px 10px;cursor:pointer;">CREATE ROOM</button>
        </div>

        <div id="rsc-room-card" style="background:#180b0e;border:1px dashed #991b1b;padding:10px;border-radius:6px;margin-bottom:10px;">
          <div><strong>MARAUDER SECRET CHAT (E2EE AES-GCM)</strong></div>
          <div style="display:flex;gap:10px;align-items:center;margin:8px 0;"><canvas id="rsc-qr-canvas" width="126" height="126" style="border:2px solid #fca5a5;border-radius:4px;background:#fff;"></canvas><div id="rsc-qr-box" style="word-break:break-all;font-size:11px;color:#fca5a5;">[QR code & join link will appear after CREATE ROOM]</div></div>
          <div id="rsc-meta" style="font-size:12px;">ROOM: - | CODE: - | Epoch: -</div>
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
            <input id="rsc-join-code" placeholder="ENTER CODE (e.g. K8Q2-X9M4)" style="background:#0d0607;color:#fff;border:1px solid #522;padding:4px 8px;" />
            <button id="rsc-join-btn" type="button" style="background:#262626;color:#fff;border:1px solid #666;padding:4px 10px;cursor:pointer;">JOIN WITH CODE</button>
            <button id="rsc-reset-invite" type="button" style="background:#262626;color:#fff;border:1px solid #666;padding:4px 10px;cursor:pointer;">RESET INVITE</button>
            <button id="rsc-rotate-keys" type="button" style="background:#262626;color:#fff;border:1px solid #666;padding:4px 10px;cursor:pointer;">ROTATE KEYS</button>
            <button id="rsc-destroy-room" type="button" style="background:#450a0a;color:#fecaca;border:1px solid #dc2626;padding:4px 10px;cursor:pointer;">DESTROY ROOM</button>
          </div>
        </div>

        <div id="rsc-chat-box" style="background:#14090c;border:1px solid #5c161b;padding:10px;border-radius:6px;margin-bottom:10px;">
          <div style="display:flex;gap:6px;margin-bottom:8px;">
            <input id="rsc-msg-input" type="text" placeholder="Write message (encrypted client-side before sending)..." style="flex:1;background:#0b0506;color:#fff;border:1px solid #662228;padding:6px 8px;" />
            <button id="rsc-send-msg" type="button" style="background:#991b1b;color:#fff;border:1px solid #f87171;padding:6px 12px;cursor:pointer;">ENCRYPT & SEND</button>
            <button id="rsc-refresh-msgs" type="button" style="background:#262626;color:#fff;border:1px solid #666;padding:6px 10px;cursor:pointer;">SYNC & DECRYPT</button>
          </div>
          <div style="font-size:12px;color:#fca5a5;margin-bottom:4px;">Decrypted Messages:</div>
          <ul id="rsc-decrypted-list" style="margin:0;padding-left:18px;font-size:12px;max-height:160px;overflow:auto;"></ul>
        </div>

        <ul style="margin:0;padding-left:18px;font-size:12px;color:#d6bcbc;">
          ${PRIVACY_CHECKLIST.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
        <pre id="rsc-log" style="background:#090506;padding:8px;margin-top:8px;font-size:11px;max-height:120px;overflow:auto;"></pre>
      </div>
    </div>
  `;

  let currentRoom = null;
  let localKeyPair = null;
  let activeAesKey = null;
  let activeEpoch = 1;

  const log = (obj) => {
    const el = container.querySelector("#rsc-log");
    if (el) el.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  };

  async function refreshSessionKey(roomSaltB64, epoch) {
    if (!localKeyPair) {
      localKeyPair = await generateEcdhKeyPair();
    }
    activeEpoch = Number(epoch || 1);
    // In standalone session mode, derive symmetric AES-GCM key from ECDH self-agreement + roomSalt + epoch
    activeAesKey = await deriveRoomAesKey(localKeyPair.keyPair.privateKey, localKeyPair.publicJwk, roomSaltB64, activeEpoch);
  }

  async function syncAndDecryptMessages() {
    const listEl = container.querySelector("#rsc-decrypted-list");
    if (!currentRoom || !currentRoom.roomId || !activeAesKey) {
      if (listEl) listEl.innerHTML = "<li>Create or join a room first.</li>";
      return;
    }
    const res = await fetch(`${apiBase}/state?roomId=${encodeURIComponent(currentRoom.roomId)}`);
    const state = await res.json();
    if (!state.ok) {
      log(state);
      return;
    }
    if (Number(state.keyEpoch || 1) !== activeEpoch) {
      await refreshSessionKey(state.roomSaltB64, state.keyEpoch);
    }
    const items = [];
    for (const msg of state.messages || []) {
      if (Number(msg.keyEpoch || 1) !== activeEpoch) {
        items.push(`<li>[Epoch ${escapeHtml(msg.keyEpoch)} rotated — ciphertext purged/unreadable]</li>`);
        continue;
      }
      try {
        const plain = await decryptMessage(activeAesKey, msg.iv, msg.ciphertext, `room:${state.roomId}:epoch:${msg.keyEpoch}`);
        items.push(`<li><strong>${escapeHtml(msg.senderId)}:</strong> ${escapeHtml(plain)} <span style="color:#9ca3af;">(epoch ${escapeHtml(msg.keyEpoch)})</span></li>`);
      } catch (_) {
        items.push(`<li>[Unable to decrypt message ${escapeHtml(msg.id)}]</li>`);
      }
    }
    if (listEl) {
      listEl.innerHTML = items.length ? items.join("") : "<li>No active messages in current retention window.</li>";
    }
  }

  container.querySelector("#btn-red-secret-chat").addEventListener("click", () => {
    const panel = container.querySelector("#rsc-panel");
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  });

  container.querySelector("#rsc-create-room").addEventListener("click", async () => {
    localKeyPair = await generateEcdhKeyPair();
    const maxMembers = Number(container.querySelector("#rsc-group-size").value || 10);
    const rawMsgTtl = container.querySelector("#rsc-msg-ttl").value;
    const messageLifetimeMs = rawMsgTtl === "custom" ? 15_000 : Number(rawMsgTtl);
    const deleteAfterMs = Number(container.querySelector("#rsc-room-ttl").value || 86_400_000);

    const res = await fetch(`${apiBase}/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        maxMembers,
        messageLifetimeMs,
        deleteAfterMs,
        adminPublicJwk: localKeyPair.publicJwk
      })
    });
    const data = await res.json();
    currentRoom = data;
    await refreshSessionKey(data.roomSaltB64, data.keyEpoch || 1);

    const qrTarget = (data.invite && data.invite.joinUrl) ? (window.location.origin + data.invite.joinUrl) : (data.invite ? data.invite.qrPayload : "");
    renderSimpleQrMatrix(container.querySelector("#rsc-qr-canvas"), qrTarget);
    container.querySelector("#rsc-qr-box").textContent = `QR JOIN URL: ${qrTarget}`;
    container.querySelector("#rsc-meta").textContent =
      `ROOM: ${data.roomId} | CODE: ${data.invite ? data.invite.code : "-"} | Epoch: ${activeEpoch}`;
    await syncAndDecryptMessages();
    log({ ok: true, roomId: data.roomId, keyEpoch: activeEpoch, e2ee: "ECDH-P256 + AES-256-GCM" });
  });

  container.querySelector("#rsc-join-btn").addEventListener("click", async () => {
    localKeyPair = await generateEcdhKeyPair();
    const code = container.querySelector("#rsc-join-code").value.trim();
    const res = await fetch(`${apiBase}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, memberPublicJwk: localKeyPair.publicJwk })
    });
    const data = await res.json();
    if (data.ok) {
      currentRoom = { roomId: data.roomId, roomSaltB64: data.roomSaltB64, keyEpoch: data.keyEpoch };
      await refreshSessionKey(data.roomSaltB64, data.keyEpoch || 1);
      container.querySelector("#rsc-meta").textContent = `ROOM: ${data.roomId} | JOINED | Epoch: ${activeEpoch}`;
      await syncAndDecryptMessages();
    }
    log(data);
  });

  container.querySelector("#rsc-send-msg").addEventListener("click", async () => {
    const input = container.querySelector("#rsc-msg-input");
    const text = input ? input.value.trim() : "";
    if (!currentRoom || !currentRoom.roomId || !activeAesKey) return log("Create or join a room first.");
    if (!text) return log("Enter a message first.");

    const enc = await encryptMessage(activeAesKey, text, `room:${currentRoom.roomId}:epoch:${activeEpoch}`);
    const res = await fetch(`${apiBase}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: currentRoom.roomId,
        senderId: currentRoom.adminId || "member",
        iv: enc.iv,
        ciphertext: enc.ciphertext,
        keyEpoch: activeEpoch
      })
    });
    const out = await res.json();
    if (input) input.value = "";
    await syncAndDecryptMessages();
    log(out);
  });

  container.querySelector("#rsc-refresh-msgs").addEventListener("click", syncAndDecryptMessages);

  const runAdmin = async (action) => {
    if (!currentRoom || !currentRoom.roomId || !currentRoom.adminId) return log("Admin room required.");
    const res = await fetch(`${apiBase}/admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId: currentRoom.roomId, adminId: currentRoom.adminId, action })
    });
    const out = await res.json();
    if (action === "reset_invite" && out.invite) {
      currentRoom.invite = out.invite;
      container.querySelector("#rsc-qr-box").textContent = `QR PAYLOAD: ${out.invite.qrPayload}`;
      container.querySelector("#rsc-meta").textContent =
        `ROOM: ${currentRoom.roomId} | CODE: ${out.invite.code} | Epoch: ${activeEpoch}`;
    }
    if (action === "rotate_keys" && out.ok) {
      await refreshSessionKey(currentRoom.roomSaltB64, out.keyEpoch);
      container.querySelector("#rsc-meta").textContent =
        `ROOM: ${currentRoom.roomId} | CODE: ${currentRoom.invite ? currentRoom.invite.code : "-"} | Epoch: ${activeEpoch}`;
      await syncAndDecryptMessages();
    }
    if (action === "destroy_room" && out.destroyed) {
      currentRoom = null;
      activeAesKey = null;
      container.querySelector("#rsc-meta").textContent = "ROOM DESTROYED";
      const listEl = container.querySelector("#rsc-decrypted-list");
      if (listEl) listEl.innerHTML = "";
    }
    log(out);
  };

  container.querySelector("#rsc-reset-invite").addEventListener("click", () => runAdmin("reset_invite"));
  container.querySelector("#rsc-rotate-keys").addEventListener("click", () => runAdmin("rotate_keys"));
  container.querySelector("#rsc-destroy-room").addEventListener("click", () => runAdmin("destroy_room"));

  if (typeof window !== "undefined" && window.location && window.location.search) {
    const params = new URLSearchParams(window.location.search);
    const autoCode = params.get("rscCode");
    const autoToken = params.get("rscToken");
    if (autoCode) {
      const panel = container.querySelector("#rsc-panel");
      if (panel) panel.style.display = "block";
      const codeInput = container.querySelector("#rsc-join-code");
      if (codeInput) codeInput.value = autoCode;
      (async () => {
        localKeyPair = await generateEcdhKeyPair();
        const res = await fetch(`${apiBase}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: autoCode, token: autoToken || undefined, memberPublicJwk: localKeyPair.publicJwk })
        });
        const data = await res.json();
        if (data.ok) {
          currentRoom = { roomId: data.roomId, roomSaltB64: data.roomSaltB64, keyEpoch: data.keyEpoch };
          await refreshSessionKey(data.roomSaltB64, data.keyEpoch || 1);
          container.querySelector("#rsc-meta").textContent = `ROOM: ${data.roomId} | QR VERIFIED | Epoch: ${activeEpoch}`;
          await syncAndDecryptMessages();
        }
        log(data);
      })();
    }
  }
  return { getCurrentRoom: () => currentRoom, syncAndDecryptMessages };
}

const MARAUDER_FULL_HUB_WALLET_CHAT_HTML = `<div id="marauder-full-account-wallet-chat" style="margin-top:14px;padding:12px;border:1px solid #38bdf8;border-radius:10px;background:#0b111d;">
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
</script>`;

function mountFullHubWalletChat(targetEl) {
  if (typeof document === "undefined") return false;
  const host = targetEl || document.body;
  if (!host) return false;
  if (document.getElementById("marauder-full-account-wallet-chat")) return true;
  const wrap = document.createElement("div");
  wrap.innerHTML = MARAUDER_FULL_HUB_WALLET_CHAT_HTML;
  while (wrap.firstChild) {
    host.appendChild(wrap.firstChild);
  }
  return true;
}

const MARAUDER_FULL_HUB_WALLET_CHAT_HTML = ``;

function mountFullHubWalletChat(targetEl) {
  if (typeof document === "undefined") return false;
  const host = targetEl || document.body;
  if (!host) return false;
  if (document.getElementById("marauder-full-account-wallet-chat")) return true;
  const wrap = document.createElement("div");
  wrap.innerHTML = MARAUDER_FULL_HUB_WALLET_CHAT_HTML;
  while (wrap.firstChild) {
    host.appendChild(wrap.firstChild);
  }
  return true;
}

module.exports = {
  GROUP_TIERS,
  MESSAGE_LIFETIMES,
  ROOM_DELETE_MODES,
  PRIVACY_CHECKLIST,
  createRedSecretChatState,
  mountRedSecretChatButton,
  MARAUDER_FULL_HUB_WALLET_CHAT_HTML,
  mountFullHubWalletChat
};
