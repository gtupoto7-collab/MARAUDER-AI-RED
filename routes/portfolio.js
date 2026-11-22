"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PROVIDERS_CATALOG = [
  {
    id: "keeper",
    name: "Keeper (TON Wallet)",
    category: "Wallet / TON",
    verificationMode: "Self-custody / Seed backup + optional compliance",
    registerUrl: "https://keeper.finance/",
    supportUrl: "https://keeper.finance/",
    supportsCards: false,
    supportsTransfers: true
  },
  {
    id: "paypal",
    name: "PayPal",
    category: "Payments / Checkout",
    verificationMode: "Account signup + KYC / ID & bank verification",
    registerUrl: "https://www.paypal.com/webapps/mpp/account-selection",
    supportUrl: "https://developer.paypal.com/",
    supportsCards: false,
    supportsTransfers: true
  },
  {
    id: "tg_stars",
    name: "Telegram Stars",
    category: "Telegram Bot Payments",
    verificationMode: "BotFather setup + Telegram payment terms",
    registerUrl: "https://t.me/BotFather",
    supportUrl: "https://core.telegram.org/bots/payments-stars",
    supportsCards: false,
    supportsTransfers: true
  },
  {
    id: "google_pay",
    name: "Google Pay",
    category: "Wallet / Checkout API",
    verificationMode: "Google Pay / Gateway business verification",
    registerUrl: "https://pay.google.com/business/console/",
    supportUrl: "https://developers.google.com/pay/api",
    supportsCards: false,
    supportsTransfers: true
  },
  {
    id: "stripe_issuing",
    name: "Stripe Issuing",
    category: "Card Issuing",
    verificationMode: "Business account + KYC/KYB + Issuing approval",
    registerUrl: "https://dashboard.stripe.com/register",
    supportUrl: "https://docs.stripe.com/issuing",
    supportsCards: true,
    supportsTransfers: true
  },
  {
    id: "adyen_issuing",
    name: "Adyen Issuing",
    category: "Enterprise Card Issuing",
    verificationMode: "Merchant account + KYB & scheme approval",
    registerUrl: "https://www.adyen.com/signup",
    supportUrl: "https://docs.adyen.com/issuing",
    supportsCards: true,
    supportsTransfers: true
  },
  {
    id: "wallester",
    name: "Wallester",
    category: "EEA Card Issuing",
    verificationMode: "Business onboarding + KYB verification",
    registerUrl: "https://wallester.com/",
    supportUrl: "https://wallester.com/developers/",
    supportsCards: true,
    supportsTransfers: true
  },
  {
    id: "marqeta",
    name: "Marqeta",
    category: "Card Issuing Platform",
    verificationMode: "Enterprise onboarding + KYB compliance",
    registerUrl: "https://www.marqeta.com/",
    supportUrl: "https://docs.marqeta.com/",
    supportsCards: true,
    supportsTransfers: true
  },
  {
    id: "lithic",
    name: "Lithic",
    category: "Card Issuing API",
    verificationMode: "Account registration + KYC/KYB verification",
    registerUrl: "https://app.lithic.com/signup",
    supportUrl: "https://docs.lithic.com/",
    supportsCards: true,
    supportsTransfers: true
  }
];

function buildProviderPaymentRequest(channel, params = {}) {
  const ch = String(channel || "").trim().toLowerCase();
  const amount = Number(params.amount);
  const hasAmount = Number.isFinite(amount) && amount > 0;
  const note = String(params.note || "").trim();
  const recipient = String(params.recipient || "").trim();

  if (ch === "keeper" || ch === "ton") {
    if (!recipient) return { ok: false, error: "MISSING_TON_ADDRESS" };
    const qs = new URLSearchParams();
    if (hasAmount) qs.set("amount", String(Math.round(amount * 1e9)));
    if (note) qs.set("text", note);
    const query = qs.toString();
    return {
      ok: true,
      channel: "keeper",
      currency: "TON",
      paymentUrl: `ton://transfer/${encodeURIComponent(recipient)}${query ? "?" + query : ""}`,
      requiresOfficialConfirmation: true
    };
  }

  if (ch === "paypal") {
    const slug = recipient.replace(/^https?:\/\/(www\.)?paypal\.me\//i, "").replace(/^@/, "");
    if (!slug) return { ok: false, error: "MISSING_PAYPAL_HANDLE" };
    return {
      ok: true,
      channel: "paypal",
      currency: String(params.currency || "EUR"),
      paymentUrl: hasAmount
        ? `https://www.paypal.com/paypalme/${encodeURIComponent(slug)}/${encodeURIComponent(String(amount))}`
        : `https://www.paypal.com/paypalme/${encodeURIComponent(slug)}`,
      requiresOfficialConfirmation: true
    };
  }

  if (ch === "tg_stars" || ch === "stars") {
    const bot = (recipient || "marauderai_bot").replace(/^@/, "");
    const starsCount = hasAmount ? Math.max(1, Math.round(amount)) : 10;
    const payload = `stars_${starsCount}${note ? "_" + note.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 28) : ""}`;
    return {
      ok: true,
      channel: "tg_stars",
      currency: "XTR",
      starsAmount: starsCount,
      botUsername: bot,
      deepLink: `https://t.me/${encodeURIComponent(bot)}?start=${encodeURIComponent(payload)}`,
      botApiMethod: "sendInvoice",
      invoiceCurrency: "XTR",
      requiresOfficialConfirmation: true
    };
  }

  if (ch === "google_pay" || ch === "gpay") {
    return {
      ok: true,
      channel: "google_pay",
      currency: String(params.currency || "EUR"),
      amount: hasAmount ? amount : null,
      merchantName: String(params.merchantName || "MARAUDER-AI").slice(0, 80),
      gatewayProvider: String(params.gatewayProvider || "stripe").slice(0, 40),
      apiSpec: "GooglePayPaymentDataRequest",
      requiresOfficialConfirmation: true,
      note: "Real Google Pay charges require official Google Pay API + gateway token processing."
    };
  }

  return { ok: false, error: "UNSUPPORTED_CHANNEL" };
}


function encodeByteQrMatrix(text) {
  const data = Buffer.from(String(text || ""), "utf8");
  const size = data.length <= 24 ? 21 : 25;
  const grid = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));

  function placeFinder(r0, c0) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r;
        const cc = c0 + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const inBox = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const border = r === 0 || r === 6 || c === 0 || c === 6;
        const center = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        grid[rr][cc] = inBox && (border || center);
        reserved[rr][cc] = true;
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    const bit = i % 2 === 0;
    grid[6][i] = bit;
    reserved[6][i] = true;
    grid[i][6] = bit;
    reserved[i][6] = true;
  }

  const bits = [];
  for (let i = 3; i >= 0; i--) bits.push(Boolean((0x40 >> i) & 1));
  const lenWidth = size === 21 ? 8 : 16;
  for (let i = lenWidth - 1; i >= 0; i--) bits.push(Boolean((data.length >> i) & 1));
  for (const byte of data) {
    for (let i = 7; i >= 0; i--) bits.push(Boolean((byte >> i) & 1));
  }
  while (bits.length < size * size) {
    bits.push(Boolean((0xec >> (bits.length % 8)) & 1));
  }

  let idx = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (reserved[r][c]) continue;
      const rawBit = bits[idx % bits.length];
      const mask = ((r + c) % 2) === 0;
      grid[r][c] = mask ? !rawBit : rawBit;
      idx++;
    }
  }

  return { size, grid };
}

function qrMatrixToSvg(matrix, modulePx = 8, margin = 16) {
  const { size, grid } = matrix;
  const total = size * modulePx + margin * 2;
  const rects = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c]) {
        const x = margin + c * modulePx;
        const y = margin + r * modulePx;
        rects.push(`<rect x="${x}" y="${y}" width="${modulePx}" height="${modulePx}" fill="#090d16"/>`);
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total}" height="${total}" style="background:#ffffff;border-radius:8px;display:block;"><rect x="0" y="0" width="${total}" height="${total}" fill="#ffffff"/>${rects.join("")}</svg>`;
}

function renderScanPayPageHtml(state, query = {}) {
  const op = state.ownerProfile || {};
  const accounts = state.accounts || [];
  const assets = state.assets || [];
  const amt = Number(query.amount || 0);
  const hasAmt = Number.isFinite(amt) && amt > 0;
  const note = String(query.note || "").trim();

  const keeperAcc = accounts.find((a) => a.id === "keeper") || {};
  const paypalAcc = accounts.find((a) => a.id === "paypal") || {};
  const starsAcc = accounts.find((a) => a.id === "tg_stars") || {};
  const gpayAcc = accounts.find((a) => a.id === "google_pay") || {};

  const keeperAddr = String(keeperAcc.handleOrAddress || "").trim();
  const paypalHandle = String(paypalAcc.handleOrAddress || "").trim().replace(/^https?:\/\/(www\.)?paypal\.me\//i, "").replace(/^@/, "");
  const paypalDirectUrl = "https://www.paypal.com/ncp/payment/RPTDVVN5XA4XC";
  const starsBot = String(starsAcc.handleOrAddress || "marauderai_bot").trim().replace(/^@/, "");

  const keeperUrl = keeperAddr
    ? `ton://transfer/${encodeURIComponent(keeperAddr)}${hasAmt || note ? "?" + new URLSearchParams({ ...(hasAmt ? { amount: String(Math.round(amt * 1e9)) } : {}), ...(note ? { text: note } : {}) }).toString() : ""}`
    : "";
  const paypalUrl = paypalHandle && paypalHandle.startsWith("https://") ? paypalHandle : (paypalHandle ?//www.paypal.com/paypalme/${encodeURIComponent(paypalHandle)}/${encodeURIComponent(String(amt))}` : `https://www.paypal.com/paypalme/${encodeURIComponent(paypalHandle)}`)
    : "";
  const starsUrl = `https://t.me/${encodeURIComponent(starsBot)}?start=${encodeURIComponent("pay_stars_" + (hasAmt ? amt : "custom") + (note ? "_" + note.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 24) : ""))}`;

  const cryptoRows = assets.filter((a) => Number(a.balance || 0) > 0 || a.important).map((a) =>
    `<div class="item"><span><strong>${a.symbol}</strong> (${a.name})</span><span>${a.balance} | ${a.fiatEur} ${op.currency || "EUR"}</span></div>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MARAUDER — Плащане към портфейл</title>
  <style>
    body { margin:0; font-family:monospace; background:#090d16; color:#e6edf3; padding:16px; }
    .box { max-width:680px; margin:0 auto; background:#0f1624; border:1px solid #243044; border-radius:10px; padding:16px; }
    .card { background:#131d2e; border:1px solid #22324c; border-radius:8px; padding:12px; margin-top:10px; }
    .item { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #1d2b42; font-size:12px; }
    a.btn, button.btn { display:inline-block; background:#1d6feb; color:#fff; border:1px solid #58a6ff; padding:8px 12px; border-radius:6px; text-decoration:none; font-family:inherit; font-weight:700; cursor:pointer; margin-top:6px; }
    .muted { color:#9fb1c6; font-size:12px; }
    code { color:#8ab4f8; word-break:break-all; }
  </style>
</head>
<body>
  <div class="box">
    <h2>Плащане към портфейл — ${op.displayName || "Dani"}</h2>
    <div class="card"><strong>Бърз PayPal линк (MARAUDER-AI)</strong><p class="muted">Лимит: 5-15000 EUR • ID: RPTDVVN5XA4XC</p><a id="pay-ncp-btn" class="btn" href="https://www.paypal.com/ncp/payment/RPTDVVN5XA4XC" target="_blank" rel="noopener noreferrer">💳 Plati s PayPal</a></div>
    <p class="muted">Сканирано от друго устройство. Избери легитимен метод за реално плащане${hasAmt ? " (сума: " + amt + ")" : ""}${note ? " | бележка: " + note : ""}.</p>

    <div class="card">
      <strong>1. Keeper / TON (Крипто портфейл)</strong>
      <p class="muted">Адрес: <code>${keeperAddr || "Не е зададен пълен TON адрес в сметките"}</code></p>
      ${keeperUrl ? `<a class="btn" href="${keeperUrl}">Отвори Keeper / TON</a>` : `<span class="muted">Добави пълен TON адрес в сметката Keeper / TON.</span>`}
    </div>

    <div class="card">
      <strong>2. PayPal</strong>
      <p class="muted">Профил: <code>${paypalHandle || "Не е зададен PayPal профил"}</code></p>
      ${`<a class="btn" href="${paypalUrl || paypalDirectUrl}" target="_blank" rel="noopener noreferrer">Плати през PayPal</a>` : `<span class="muted">Добави PayPal профил/линк в сметката PayPal.</span>`}
    </div>

    <div class="card">
      <strong>3. Telegram Stars (@${starsBot})</strong>
      <p class="muted">Официален Telegram поток за звезди (XTR).</p>
      <a class="btn" href="${starsUrl}" target="_blank" rel="noopener noreferrer">Отвори в Telegram</a>
    </div>

    <div class="card">
      <strong>4. Google Pay</strong>
      <p class="muted">Референтен акаунт/мерчант: <code>${gpayAcc.handleOrAddress || "MARAUDER-AI"}</code></p>
      <p class="muted">Реалното плащане с Google Pay минава през официален Google Pay API / gateway интеграция.</p>
    </div>

    <div class="card">
      <strong>5. Крипто активи в портфейла</strong>
      ${cryptoRows || `<div class="muted">Няма показани активи.</div>`}
    </div>
  </div>
</body>
</html>`;
}

function createPortfolioRouter(dataFilePath = path.join(process.cwd(), "data", "portfolio-ledger.json")) {
  fs.mkdirSync(path.dirname(dataFilePath), { recursive: true });

  function defaultState() {
    const providerEnrollments = {};
    for (const p of PROVIDERS_CATALOG) {
      providerEnrollments[p.id] = {
        providerId: p.id,
        registered: false,
        verificationStatus: "UNVERIFIED",
        accountRef: "",
        notes: "",
        updatedAt: null
      };
    }

    return {
      ownerProfile: {
        displayName: "Dani",
        currency: "EUR",
        theme: "dark",
        searchEngine: "DuckDuckGo",
        language: "Система",
        locked: false,
        updatedAt: new Date().toISOString()
      },
      walletMeta: {
        shortAddress: "UQBOxLg-Vq86U_y1oJyUFTmvn6tedptaPQ4d3CDUq4O2T_7H",
        hideBalances: true,
        keeperConnected: true,
        paypalConnected: false,
        telegramConnected: true,
        googlePayConnected: false,
        connectedApps: ["Keeper", "PayPal", "Telegram Stars", "Google Pay"]
      },
      providersCatalog: PROVIDERS_CATALOG,
      providerEnrollments,
      assets: [
        { symbol: "GRAM", name: "GRAM", balance: 0, fiatEur: 0, changePct: -2.65, staked: 0, important: true },
        { symbol: "ETH", name: "Ethereum", balance: 0, fiatEur: 0, changePct: 4.34, staked: 0, important: true },
        { symbol: "BNB", name: "BNB", balance: 0, fiatEur: 0, changePct: 1.89, staked: 0, important: false },
        { symbol: "SOL", name: "Solana", balance: 0, fiatEur: 0, changePct: 1.96, staked: 0, important: false },
        { symbol: "USDT", name: "USDT (TRON)", balance: 0, fiatEur: 0, changePct: 0.11, staked: 0, important: true }
      ],
      accounts: [
        { id: "keeper", label: "Keeper / TON", handleOrAddress: "UQBOxLg-Vq86U_y1oJyUFTmvn6tedptaPQ4d3CDUq4O2T_7H", balance: 0, currency: "TON", active: true, important: true },
        { id: "paypal", label: "PayPal", handleOrAddress: "", balance: 0, currency: "EUR", active: false, important: true },
        { id: "tg_stars", label: "Telegram Stars", handleOrAddress: "", balance: 0, currency: "XTR", active: true, important: true },
        { id: "google_pay", label: "Google Pay", handleOrAddress: "", balance: 0, currency: "EUR", active: false, important: true }
      ],
      transfers: []
    };
  }

  function loadState() {
    const base = defaultState();
    if (!fs.existsSync(dataFilePath)) {
      fs.writeFileSync(dataFilePath, JSON.stringify(base, null, 2) + "\n", "utf8");
      return base;
    }
    const raw = JSON.parse(fs.readFileSync(dataFilePath, "utf8"));
    return {
      ...base,
      ...raw,
      ownerProfile: { ...base.ownerProfile, ...(raw.ownerProfile || {}) },
      walletMeta: { ...base.walletMeta, ...(raw.walletMeta || {}) },
      providersCatalog: PROVIDERS_CATALOG,
      providerEnrollments: { ...base.providerEnrollments, ...(raw.providerEnrollments || {}) }
    };
  }

  function saveState(state) {
    state.ownerProfile.updatedAt = new Date().toISOString();
    fs.writeFileSync(dataFilePath, JSON.stringify(state, null, 2) + "\n", "utf8");
  }

  function handleRequest(req, res, pathname, bodyJson) {
    if (!pathname.startsWith("/api/portfolio")) return false;
    const state = loadState();

    const send = (status, payload) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(JSON.stringify(payload));
      return true;
    };

    if (req.method === "GET" && pathname === "/api/portfolio") {
      return send(200, { ok: true, ...state });
    }

    if (req.method === "GET" && pathname === "/api/portfolio/providers") {
      return send(200, {
        ok: true,
        providers: state.providersCatalog,
        enrollments: state.providerEnrollments
      });
    }

    if (req.method === "POST" && pathname === "/api/portfolio/provider-enrollment") {
      const b = bodyJson || {};
      const providerId = String(b.providerId || "").trim();
      const catItem = PROVIDERS_CATALOG.find((p) => p.id === providerId);
      if (!catItem) return send(404, { ok: false, error: "UNKNOWN_PROVIDER" });

      const allowedStatuses = ["UNVERIFIED", "PENDING_KYC", "VERIFIED"];
      const nextStatus = allowedStatuses.includes(String(b.verificationStatus || "").toUpperCase())
        ? String(b.verificationStatus).toUpperCase()
        : (state.providerEnrollments[providerId]?.verificationStatus || "UNVERIFIED");

      const registered = typeof b.registered === "boolean"
        ? b.registered
        : Boolean(state.providerEnrollments[providerId]?.registered);

      state.providerEnrollments[providerId] = {
        providerId,
        registered,
        verificationStatus: nextStatus,
        accountRef: typeof b.accountRef === "string"
          ? b.accountRef.trim().slice(0, 140)
          : (state.providerEnrollments[providerId]?.accountRef || ""),
        notes: typeof b.notes === "string"
          ? b.notes.trim().slice(0, 240)
          : (state.providerEnrollments[providerId]?.notes || ""),
        updatedAt: new Date().toISOString()
      };

      saveState(state);
      return send(200, { ok: true, provider: catItem, enrollment: state.providerEnrollments[providerId], state });
    }

    if (req.method === "POST" && pathname === "/api/portfolio/channels/prepare") {
      const b = bodyJson || {};
      const prepared = buildProviderPaymentRequest(b.channel, b);
      if (!prepared.ok) return send(400, prepared);
      return send(200, { ok: true, prepared });
    }

    if (req.method === "POST" && pathname === "/api/portfolio/settings") {
      const b = bodyJson || {};
      if (typeof b.displayName === "string") state.ownerProfile.displayName = b.displayName.trim().slice(0, 120);
      if (typeof b.currency === "string" && b.currency.trim()) state.ownerProfile.currency = b.currency.trim().slice(0, 12);
      if (typeof b.theme === "string") state.ownerProfile.theme = b.theme === "light" ? "light" : "dark";
      if (typeof b.searchEngine === "string") state.ownerProfile.searchEngine = b.searchEngine.trim().slice(0, 60);
      if (typeof b.language === "string") state.ownerProfile.language = b.language.trim().slice(0, 40);
      if (typeof b.locked === "boolean") state.ownerProfile.locked = b.locked;
      if (typeof b.hideBalances === "boolean") state.walletMeta.hideBalances = b.hideBalances;
      if (typeof b.keeperConnected === "boolean") state.walletMeta.keeperConnected = b.keeperConnected;
      if (typeof b.paypalConnected === "boolean") state.walletMeta.paypalConnected = b.paypalConnected;
      if (typeof b.telegramConnected === "boolean") state.walletMeta.telegramConnected = b.telegramConnected;
      if (typeof b.googlePayConnected === "boolean") state.walletMeta.googlePayConnected = b.googlePayConnected;
      if (typeof b.shortAddress === "string" && b.shortAddress.trim()) {
        state.walletMeta.shortAddress = b.shortAddress.trim().slice(0, 40);
      }
      saveState(state);
      return send(200, { ok: true, state });
    }

    if (req.method === "POST" && pathname === "/api/portfolio/account") {
      const b = bodyJson || {};
      if (typeof b.displayName === "string") state.ownerProfile.displayName = b.displayName.trim().slice(0, 120);
      const acc = state.accounts.find((a) => a.id === b.accountId);
      if (!acc) return send(404, { ok: false, error: "ACCOUNT_NOT_FOUND" });

      if (typeof b.handleOrAddress === "string") acc.handleOrAddress = b.handleOrAddress.trim().slice(0, 180);
      if (b.balance !== undefined && !Number.isNaN(Number(b.balance))) acc.balance = Number(b.balance);
      if (typeof b.currency === "string" && b.currency.trim()) acc.currency = b.currency.trim().slice(0, 12);
      if (typeof b.active === "boolean") acc.active = b.active;
      if (typeof b.important === "boolean") acc.important = b.important;

      saveState(state);
      return send(200, { ok: true, account: acc, state });
    }

    if (req.method === "POST" && pathname === "/api/portfolio/asset") {
      const b = bodyJson || {};
      const sym = String(b.symbol || "").trim().toUpperCase();
      if (!sym) return send(400, { ok: false, error: "SYMBOL_REQUIRED" });
      let asset = state.assets.find((a) => a.symbol === sym);
      if (!asset) {
        asset = { symbol: sym, name: String(b.name || sym), balance: 0, fiatEur: 0, changePct: 0, staked: 0, important: Boolean(b.important) };
        state.assets.push(asset);
      }
      if (b.balance !== undefined && !Number.isNaN(Number(b.balance))) asset.balance = Number(b.balance);
      if (b.fiatEur !== undefined && !Number.isNaN(Number(b.fiatEur))) asset.fiatEur = Number(b.fiatEur);
      if (b.staked !== undefined && !Number.isNaN(Number(b.staked))) asset.staked = Number(b.staked);
      if (typeof b.important === "boolean") asset.important = b.important;
      saveState(state);
      return send(200, { ok: true, asset, state });
    }

    if (req.method === "POST" && pathname === "/api/portfolio/action") {
      const b = bodyJson || {};
      const action = String(b.action || "").toLowerCase();
      const rawMethod = String(b.method || b.symbol || "keeper").toLowerCase();
      const method = rawMethod === "ton" ? "keeper" : (rawMethod === "stars" ? "tg_stars" : (rawMethod === "gpay" ? "google_pay" : rawMethod));
      const amount = Number(b.amount);
      const target = String(b.target || b.recipient || "").trim();
      const important = Boolean(b.important);

      if (!["send", "buy", "swap", "stake"].includes(action)) {
        return send(400, { ok: false, error: "UNSUPPORTED_ACTION" });
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return send(400, { ok: false, error: "INVALID_AMOUNT" });
      }

      const acc = state.accounts.find((a) => a.id === method);
      if (acc) {
        if (action === "send" || action === "stake") {
          if (acc.balance < amount) return send(409, { ok: false, error: "INSUFFICIENT_BALANCE" });
          acc.balance = Number((acc.balance - amount).toFixed(6));
        } else if (action === "buy") {
          acc.balance = Number((acc.balance + amount).toFixed(6));
        }
      }

      const tx = {
        id: "tx_" + crypto.randomBytes(6).toString("hex"),
        action,
        method,
        direction: action === "buy" ? "incoming" : "outgoing",
        amount,
        currency: acc ? acc.currency : state.ownerProfile.currency,
        recipient: target || (action === "stake" ? "Staking Pool" : action === "swap" ? "Swap Pair" : "Self"),
        note: String(b.note || "").slice(0, 200),
        important,
        status: "RECORDED",
        createdAt: new Date().toISOString()
      };
      state.transfers.unshift(tx);
      saveState(state);
      return send(201, { ok: true, transfer: tx, state });
    }

    if (req.method === "POST" && pathname === "/api/portfolio/transfer") {
      const b = bodyJson || {};
      const rawMethod = String(b.method || "").toLowerCase();
      const method = rawMethod === "ton" ? "keeper" : (rawMethod === "stars" ? "tg_stars" : (rawMethod === "gpay" ? "google_pay" : rawMethod));
      const amount = Number(b.amount);
      const recipient = String(b.recipient || "").trim();
      const direction = b.direction === "incoming" ? "incoming" : "outgoing";
      const important = Boolean(b.important);

      if (!["keeper", "paypal", "tg_stars", "google_pay", "crypto"].includes(method)) {
        return send(400, { ok: false, error: "UNSUPPORTED_PAYMENT_METHOD" });
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        return send(400, { ok: false, error: "INVALID_AMOUNT" });
      }
      if (!recipient) {
        return send(400, { ok: false, error: "RECIPIENT_REQUIRED" });
      }

      const acc = state.accounts.find((a) => a.id === method);
      if (direction === "outgoing" && acc && acc.balance < amount) {
        return send(409, { ok: false, error: "INSUFFICIENT_BALANCE" });
      }
      if (acc) {
        acc.balance = direction === "outgoing"
          ? Number((acc.balance - amount).toFixed(6))
          : Number((acc.balance + amount).toFixed(6));
      }

      const tx = {
        id: "tx_" + crypto.randomBytes(6).toString("hex"),
        action: direction === "incoming" ? "buy" : "send",
        method,
        direction,
        amount,
        currency: acc ? acc.currency : state.ownerProfile.currency,
        recipient,
        note: String(b.note || "").slice(0, 200),
        important,
        status: "RECORDED",
        createdAt: new Date().toISOString()
      };
      state.transfers.unshift(tx);
      saveState(state);
      return send(201, { ok: true, transfer: tx, state });
    }

    if (req.method === "POST" && pathname === "/api/portfolio/virtual-card") {
      const b = bodyJson || {};
      const label = String(b.label || "MARAUDER Reference Profile").trim().slice(0, 80);
      const last4 = String(crypto.randomInt(1000, 9999));
      const expMonth = String(crypto.randomInt(1, 13)).padStart(2, "0");
      const expYear = String(new Date().getFullYear() + 3).slice(-2);
      const cardProfile = {
        id: "refcard_" + crypto.randomBytes(5).toString("hex"),
        label,
        maskedRef: "REF •••• •••• " + last4,
        expiryRef: expMonth + "/" + expYear,
        note: "Internal reference only. Real payment cards & Google Wallet provisioning require a licensed issuer and approval.",
        createdAt: new Date().toISOString()
      };
      state.walletMeta.virtualCard = cardProfile;
      saveState(state);
      return send(201, { ok: true, virtualCard: cardProfile, state });
    }

    
    if (req.method === "POST" && pathname === "/api/portfolio/client-kyc") {
      const b = bodyJson || {};
      const authProvider = String(b.authProvider || "local").trim().slice(0, 32);
      const clientHandle = String(b.clientHandle || "").trim().slice(0, 140);
      const allowedKyc = ["NONE", "PENDING", "VERIFIED"];
      const nextKyc = allowedKyc.includes(String(b.kycStatus || "").toUpperCase())
        ? String(b.kycStatus).toUpperCase()
        : "NONE";

      state.ownerProfile = {
        ...state.ownerProfile,
        authProvider,
        clientHandle,
        kycStatus: nextKyc,
        kycVerified: nextKyc === "VERIFIED",
        updatedAt: new Date().toISOString()
      };
      saveState(state);
      return send(200, { ok: true, ownerProfile: state.ownerProfile, state });
    }

    if (req.method === "POST" && pathname === "/api/portfolio/issuer-config") {
      const b = bodyJson || {};
      if (!state.ownerProfile || !state.ownerProfile.kycVerified) {
        return send(403, { ok: false, error: "FULL_KYC_VERIFICATION_REQUIRED" });
      }
      const b = bodyJson || {};
      const provider = String(b.provider || "").trim().slice(0, 60);
      const cardRef = String(b.cardRef || "").trim().slice(0, 80);
      const last4 = String(b.last4 || "").replace(/\D/g, "").slice(-4);
      const googleWalletEligible = Boolean(b.googleWalletEligible);
      state.walletMeta.cardIssuer = {
        provider,
        cardRef,
        last4,
        googleWalletEligible,
        configuredEnvKey: "CARD_ISSUER_API_KEY",
        updatedAt: new Date().toISOString()
      };
      saveState(state);
      return send(200, { ok: true, cardIssuer: state.walletMeta.cardIssuer, state });
    }

    
    if (req.method === "GET" && pathname === "/api/portfolio/qr") {
      const urlObj = new URL(req.url || "/api/portfolio/qr", "http://127.0.0.1");
      const amount = urlObj.searchParams.get("amount") || "";
      const note = urlObj.searchParams.get("note") || "";
      const proto = (req.headers["x-forwarded-proto"] || "http").toString().split(",")[0].trim();
      const host = (req.headers["x-forwarded-host"] || req.headers["host"] || "127.0.0.1:3000").toString().trim();
      const qs = new URLSearchParams();
      if (amount) qs.set("amount", amount);
      if (note) qs.set("note", note);
      const targetUrl = `${proto}://${host}/pay${qs.toString() ? "?" + qs.toString() : ""}`;
      const matrix = encodeByteQrMatrix(targetUrl);
      const svg = qrMatrixToSvg(matrix, 7, 14);
      return send(200, { ok: true, targetUrl, matrix, svg });
    }

    if (req.method === "GET" && pathname === "/pay") {
      const urlObj = new URL(req.url || "/pay", "http://127.0.0.1");
      const html = renderScanPayPageHtml(state, {
        amount: urlObj.searchParams.get("amount") || "",
        note: urlObj.searchParams.get("note") || ""
      });
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(html);
      return true;
    }

    return send(404, { ok: false, error: "NOT_FOUND" });
  }

  return { handleRequest, loadState, PROVIDERS_CATALOG, buildProviderPaymentRequest };
}

module.exports = { createPortfolioRouter, PROVIDERS_CATALOG, buildProviderPaymentRequest };
