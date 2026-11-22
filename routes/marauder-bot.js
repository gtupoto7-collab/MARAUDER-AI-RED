"use strict";

function buildBotPaymentLink(method, handle, amount, note) {
  const cleanMethod = String(method || "").trim().toLowerCase();
  const cleanHandle = String(handle || "").trim();
  const numAmt = Number(amount);
  const hasAmt = Number.isFinite(numAmt) && numAmt > 0;
  const cleanNote = String(note || "").trim();

  if (cleanMethod === "paypal") {
    const slug = cleanHandle.replace(/^https?:\/\/(www\.)?paypal\.me\//i, "").replace(/^@/, "");
    if (!slug) return { ok: false, error: "MISSING_PAYPAL_HANDLE" };
    const url = hasAmt
      ? `https://www.paypal.com/paypalme/${encodeURIComponent(slug)}/${encodeURIComponent(String(numAmt))}`
      : `https://www.paypal.com/paypalme/${encodeURIComponent(slug)}`;
    return { ok: true, method: "paypal", url };
  }

  if (cleanMethod === "ton" || cleanMethod === "keeper") {
    if (!cleanHandle) return { ok: false, error: "MISSING_TON_ADDRESS" };
    const params = new URLSearchParams();
    if (hasAmt) params.set("amount", String(Math.round(numAmt * 1e9)));
    if (cleanNote) params.set("text", cleanNote);
    const qs = params.toString();
    return {
      ok: true,
      method: cleanMethod === "keeper" ? "keeper" : "ton",
      url: `ton://transfer/${encodeURIComponent(cleanHandle)}${qs ? "?" + qs : ""}`
    };
  }

  if (cleanMethod === "stars" || cleanMethod === "tg_stars") {
    const bot = (cleanHandle || "marauderai_bot").replace(/^@/, "");
    if (!bot) return { ok: false, error: "MISSING_BOT_USERNAME" };
    const payload = `pay_stars_${hasAmt ? numAmt : "custom"}${cleanNote ? "_" + cleanNote.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32) : ""}`;
    return { ok: true, method: "tg_stars", url: `https://t.me/${encodeURIComponent(bot)}?start=${encodeURIComponent(payload)}` };
  }

  if (cleanMethod === "gpay" || cleanMethod === "google_pay") {
    const label = cleanHandle || "MARAUDER-AI";
    const qs = new URLSearchParams();
    qs.set("merchant", label);
    if (hasAmt) qs.set("amount", String(numAmt));
    if (cleanNote) qs.set("note", cleanNote);
    return {
      ok: true,
      method: "google_pay",
      url: `gpay://checkout?${qs.toString()}`
    };
  }

  return { ok: false, error: "UNSUPPORTED_METHOD" };
}

function safeLoadPortfolioState(portfolioRouter) {
  try {
    if (portfolioRouter && typeof portfolioRouter.loadState === "function") {
      return portfolioRouter.loadState();
    }
  } catch (_) {}
  return {
    ownerProfile: { displayName: "Dani", currency: "EUR" },
    walletMeta: { hideBalances: true },
    accounts: [
      { label: "Keeper / TON", balance: 0, currency: "TON" },
      { label: "PayPal", balance: 0, currency: "EUR" },
      { label: "Telegram Stars", balance: 0, currency: "XTR" },
      { label: "Google Pay", balance: 0, currency: "EUR" }
    ]
  };
}

function createMarauderBotEngine(options = {}) {
  const token = String(options.token || process.env.TELEGRAM_BOT_TOKEN || "").trim();

  let portfolioRouter = options.portfolioRouter || null;
  if (!portfolioRouter) {
    try {
      const { createPortfolioRouter } = require("./portfolio");
      portfolioRouter = createPortfolioRouter();
    } catch (_) {
      portfolioRouter = null;
    }
  }

  let secretChatRouter = options.secretChatRouter || null;
  if (!secretChatRouter) {
    try {
      const { createRedSecretChatRouter } = require("./red-secret-chat");
      secretChatRouter = createRedSecretChatRouter();
    } catch (_) {
      secretChatRouter = null;
    }
  }

  function formatHelpText() {
    return [
      "MARAUDER-AI BOT (@marauderai_bot)",
      "",
      "/start - Начало и активен профил",
      "/help - Списък с команди",
      "/portfolio - Преглед на портфейл и сметки",
      "/paylink <keeper|paypal|stars|gpay> <adres/user/merchant> [suma] [belezhka] - Генериране на линк/заявка",
      "/secret - Информация за RED SECRET CHAT и поверителност",
      "/status - Статус на модулите и ограниченията"
    ].join("\n");
  }

  function handleCommand(rawText = "") {
    const text = String(rawText || "").trim();
    const parts = text.split(/\s+/);
    const cmd = (parts[0] || "").toLowerCase();

    if (cmd === "/start") {
      const pf = safeLoadPortfolioState(portfolioRouter);
      return {
        ok: true,
        command: "/start",
        reply: `Здравей, ${pf.ownerProfile?.displayName || "Dani"}! @marauderai_bot е готов. Използвай /help за командите.`
      };
    }

    if (cmd === "/help" || cmd === "/commands") {
      return {
        ok: true,
        command: "/help",
        reply: formatHelpText()
      };
    }

    if (cmd === "/portfolio") {
      const pf = safeLoadPortfolioState(portfolioRouter);
      const summary = (pf.accounts || [])
        .map((a) => `• ${a.label}: ${pf.walletMeta && pf.walletMeta.hideBalances ? "***" : a.balance} ${a.currency}`)
        .join("\n");
      return {
        ok: true,
        command: "/portfolio",
        reply: `Портфейл (${pf.ownerProfile?.currency || "EUR"}):\n${summary}\n\nЗа реални преводи се използват официалните потоци за Keeper, PayPal, Telegram Stars и Google Pay.`
      };
    }

    if (cmd === "/paylink" || cmd === "/link") {
      const method = parts[1];
      const handle = parts[2];
      const maybeAmt = parts[3] && !Number.isNaN(Number(parts[3])) ? Number(parts[3]) : undefined;
      const note = maybeAmt !== undefined ? parts.slice(4).join(" ") : parts.slice(3).join(" ");

      const built = buildBotPaymentLink(method, handle, maybeAmt, note);
      if (!built.ok) {
        return {
          ok: false,
          command: "/paylink",
          reply: `Грешка (${built.error}). Пример:\n/paylink keeper UQBO...T_7H 2.5 order\n/paylink paypal dani_bg 25 usluga\n/paylink stars marauderai_bot 50 stars\n/paylink gpay MARAUDER-AI 15 checkout`
        };
      }
      return {
        ok: true,
        command: "/paylink",
        reply: `Линк/заявка за плащане (${built.method}):\n${built.url}\n\nБележка: реалното потвърждение на средствата се проверява през съответния официален портфейл, платформа или API/gateway.`
      };
    }

    if (cmd === "/secret") {
      return {
        ok: true,
        command: "/secret",
        reply: [
          "RED SECRET CHAT (E2EE ECDH + AES-GCM):",
          "• Еднократни покани с QR / код и ротация на ключове (keyEpoch)",
          "• Таймери за изтриване на съобщения и стаи",
          "• Бележка: сървърът/мрежата могат да виждат метаданни/IP без VPN/Tor, а скрийншот не може да бъде гарантирано спрян."
        ].join("\n")
      };
    }

    if (cmd === "/status") {
      const roomsCount = secretChatRouter && secretChatRouter.rooms ? secretChatRouter.rooms.size : 0;
      return {
        ok: true,
        command: "/status",
        reply: `Bot token configured: ${token ? "YES" : "NO"} | Portfolio module: ${portfolioRouter ? "OK" : "FALLBACK"} | Active rooms: ${roomsCount}`
      };
    }

    return {
      ok: true,
      command: "echo",
      reply: `Получих: "${text}". Напиши /help за списък с команди.`
    };
  }

  async function sendTelegramMessage(chatId, text, botToken = token) {
    if (!botToken) {
      return { ok: false, error: "MISSING_TELEGRAM_BOT_TOKEN" };
    }
    const endpoint = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    const data = await res.json();
    return { ok: Boolean(data && data.ok), telegramResponse: data };
  }

  async function pollOnce(botToken = token, offset = 0) {
    if (!botToken) {
      return { ok: false, error: "MISSING_TELEGRAM_BOT_TOKEN" };
    }
    const url = `https://api.telegram.org/bot${botToken}/getUpdates?timeout=10&offset=${Number(offset) || 0}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data || !data.ok) {
      return { ok: false, error: "GET_UPDATES_FAILED", detail: data };
    }

    let nextOffset = offset;
    const processed = [];
    for (const upd of data.result || []) {
      nextOffset = Math.max(nextOffset, Number(upd.update_id) + 1);
      const msg = upd.message || upd.edited_message;
      if (msg && msg.chat && typeof msg.text === "string") {
        const out = handleCommand(msg.text);
        const sent = await sendTelegramMessage(msg.chat.id, out.reply, botToken);
        processed.push({ updateId: upd.update_id, chatId: msg.chat.id, text: msg.text, sentOk: sent.ok });
      }
    }
    return { ok: true, nextOffset, processed };
  }

  return {
    handleCommand,
    sendTelegramMessage,
    pollOnce,
    formatHelpText,
    buildBotPaymentLink
  };
}

module.exports = { createMarauderBotEngine, buildBotPaymentLink };


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
