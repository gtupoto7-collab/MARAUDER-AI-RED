"use strict";

function renderPortfolioPageHtml(apiBase = "/api/portfolio") {
  return `<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MARAUDER — PORTOFEIL (Keeper / PayPal / Telegram / Vajni)</title>
  <style>
    body { margin:0; font-family:monospace; background:#090d16; color:#e6edf3; padding:16px; }
    .wrap { max-width:1020px; margin:0 auto; border:1px solid #243044; background:#0f1624; border-radius:10px; padding:16px; }
    .top { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px; }
    .addr { background:#162238; padding:5px 10px; border-radius:999px; font-size:12px; color:#8ab4f8; }
    .actions { display:grid; grid-template-columns:repeat(4,minmax(110px,1fr)); gap:8px; margin:12px 0; }
    .card { background:#131d2e; border:1px solid #22324c; border-radius:8px; padding:10px; margin-bottom:10px; }
    .row { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px; align-items:center; }
    input, select, button { background:#0a0f1a; color:#e6edf3; border:1px solid #334663; padding:7px 10px; border-radius:6px; font-family:inherit; }
    button { cursor:pointer; background:#18263b; }
    button.primary { background:#1d6feb; border-color:#58a6ff; color:#fff; font-weight:700; }
    .tabs { display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; border-top:1px solid #22324c; padding-top:10px; }
    .asset-item { display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #1d2b42; font-size:12px; }
    table { width:100%; border-collapse:collapse; font-size:12px; margin-top:8px; }
    th, td { border-bottom:1px solid #1d2b42; padding:6px; text-align:left; }
    .hint { font-size:11px; color:#9fb1c6; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div>
        <strong id="pf-title">Портфейл — Dani</strong>
        <span id="pf-addr" class="addr">UQBO...T_7H</span>
      </div>
      <div class="row" style="margin:0;">
        <button id="pf-toggle-hide" type="button">Скрий/Покажи (***)</button>
        <button id="pf-lock-btn" type="button">Заключи / Изход</button>
      </div>
    </div>

    <div id="tab-portfolio">
      
      <div class="card" id="pf-direct-pay-card">
        <strong>Директно плащане / дарение (PayPal и Keeper / TON)</strong>
        <p class="hint">Ползва записания PayPal профил/линк и TON адрес от сметките ти или полетата по-долу. Реалното потвърждение винаги се следи в съответния портфейл/платформа.</p>
        <div class="row" style="margin-top:8px;">
          <input id="pf-direct-amt" type="number" step="any" placeholder="Сума (по избор)" style="width:150px;" />
          <input id="pf-direct-note" placeholder="Бележка / цел (по избор)" style="flex:1;" />
          <button id="pf-direct-paypal-btn" class="primary" type="button">💳 Плати / Дари с PayPal</button>
          <button id="pf-direct-keeper-btn" class="primary" type="button">💎 Плати / Дари с Keeper (TON)</button>
          <button id="pf-open-links-tab-btn" type="button">🔗 Отвори таб Linkove</button>
          <button id="pf-show-qr-btn" type="button">📱 QR за друго устройство</button>
        </div>
        <div id="pf-direct-status" class="hint"></div>
        <div id="pf-qr-panel" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid #22324c;">
          <div id="pf-qr-url" class="hint" style="margin-bottom:8px;word-break:break-all;"></div>
          <div id="pf-qr-svg-wrap"></div>
        </div>
  
      </div>
  
      <div class="actions">
        <button data-act="send" type="button">↑ Изпращане</button>
        <button data-act="buy" type="button">↓ Купи</button>
        <button data-act="swap" type="button">⇅ Смяна</button>
        <button data-act="stake" type="button">↗ Стейк</button>
      </div>

      <div class="card">
        <strong>Сметки (Keeper / PayPal / Telegram Stars)</strong>
        <div class="row" style="margin-top:8px;">
          <select id="pf-acc-id">
            <option value="keeper">Keeper / TON</option>
            <option value="paypal">PayPal</option>
            <option value="tg_stars">Telegram Stars</option>
          </select>
          <input id="pf-acc-handle" placeholder="TON adres / PayPal user / @bot" />
          <input id="pf-acc-bal" type="number" step="any" placeholder="Balans" />
          <label class="hint"><input id="pf-acc-imp" type="checkbox" checked /> Vajna</label>
          <button id="pf-save-acc" class="primary" type="button">Zapazi</button>
        </div>
        <div id="pf-acc-list" class="hint"></div>
      </div>

      <div class="card">
        <strong>Крипто и активи</strong>
        <div class="row" style="margin-top:8px;">
          <input id="pf-asset-sym" placeholder="Simvol (GRAM, ETH, USDT)" style="width:150px;" />
          <input id="pf-asset-bal" type="number" step="any" placeholder="Kolichestvo" style="width:130px;" />
          <input id="pf-asset-eur" type="number" step="any" placeholder="Stoinost (EUR)" style="width:130px;" />
          <label class="hint"><input id="pf-asset-imp" type="checkbox" /> Vajen</label>
          <button id="pf-save-asset" type="button">Obnovi aktiv</button>
        </div>
        <div id="pf-assets-list"></div>
      </div>

      <div class="card">
        <strong>Операция / Превод</strong>
        <div class="row" style="margin-top:8px;">
          <select id="pf-tx-action">
            <option value="send">Изпращане (send)</option>
            <option value="buy">Купи (buy)</option>
            <option value="swap">Смяна (swap)</option>
            <option value="stake">Стейк (stake)</option>
          </select>
          <select id="pf-tx-method">
            <option value="keeper">Keeper / TON</option>
            <option value="paypal">PayPal</option>
            <option value="tg_stars">Telegram Stars</option>
            <option value="crypto">Crypto</option>
          </select>
          <input id="pf-tx-amount" type="number" step="any" placeholder="Suma" />
          <input id="pf-tx-target" placeholder="Poluchatel / adresa / dvoika" />
          <label class="hint"><input id="pf-tx-imp" type="checkbox" /> Vajna</label>
          <button id="pf-run-tx" class="primary" type="button">Izpulni / Zapischi</button>
        </div>
        <table>
          <thead><tr><th>Data</th><th>Vajna</th><th>Deistvie</th><th>Metod</th><th>Suma</th><th>Cel</th><th>Status</th></tr></thead>
          <tbody id="pf-tx-rows"></tbody>
        </table>
      </div>
    </div>

    
      <div class="card" id="pf-kyc-card">
        <strong>Вход и верификация на клиента (Gmail / GitHub / Регистрация)</strong>
        <p class="hint">Записва само статуса на вход и верификация на клиента. Реалната карта и NFC плащанията изискват потвърден KYC/KYB при лицензиран доставчик.</p>
        <div class="row" style="margin-top:8px;">
          <select id="pf-auth-provider">
            <option value="gmail">Gmail</option>
            <option value="github">GitHub</option>
            <option value="registration">Регистрация</option>
          </select>
          <input id="pf-client-handle" placeholder="Имейл / GitHub потребител / акаунт" style="flex:1;" />
          <select id="pf-kyc-status">
            <option value="NONE">NONE</option>
            <option value="PENDING">PENDING</option>
            <option value="VERIFIED">VERIFIED</option>
          </select>
          <button id="pf-kyc-save" class="primary" type="button">Запази вход и статус</button>
        </div>
        <div id="pf-kyc-summary" class="hint"></div>
      </div>
  
    
      <div class="card" id="pf-issuer-card">
        <strong>Конфигурация на карта / Издател (Card Issuer)</strong>
        <p class="hint">Записва само референтен идентификатор (cardRef / last4) на карта при лицензиран доставчик — изисква статус VERIFIED.</p>
        <div class="row" style="margin-top:8px;">
          <input id="pf-issuer-provider" placeholder="Доставчик (напр. Stripe Issuing, Wallester)" style="width:210px;" />
          <input id="pf-issuer-ref" placeholder="Card Ref / ID" style="width:160px;" />
          <input id="pf-issuer-last4" placeholder="Последни 4 цифри" maxlength="4" style="width:120px;" />
          <label class="hint"><input id="pf-issuer-gwallet" type="checkbox" /> Google Wallet готовност</label>
          <button id="pf-issuer-save" class="primary" type="button">Запази карта/референция</button>
        </div>
        <div id="pf-issuer-warning" class="hint" style="color:#f87171;"></div>
        <div id="pf-issuer-summary" class="hint"></div>
      </div>
  
    
      <div class="card" id="pf-vcard-card">
        <strong>Вътрешен референтен профил на карта (Само за отчитане в приложението)</strong>
        <p class="hint">Генерира само вътрешен референтен идентификатор (REF •••• •••• XXXX) за бележки в портфейла — не е реална дебитна/NFC карта и не се добавя директно в Google Wallet.</p>
        <div class="row" style="margin-top:8px;">
          <input id="pf-vcard-label" placeholder="Етикет на профила (напр. MARAUDER Ref)" style="flex:1;" />
          <button id="pf-vcard-gen" class="primary" type="button">Генерирай референтен профил</button>
        </div>
        <div id="pf-vcard-warning" class="hint" style="color:#f87171;"></div>
        <div id="pf-vcard-summary" class="hint"></div>
      </div>
  
    
      <div class="card" id="pf-accounts-overview-card">
        <strong>Справка за сметките и техния статус</strong>
        <p class="hint">Показыва текущото състояние на сметките в портфейла без да съхранява данни за карти или лични документи.</p>
        <div id="pf-accounts-overview-list" class="hint" style="margin-top:8px;">Зареждане на сметките...</div>
      </div>
  
    <div id="tab-important" style="display:none;" class="card">
      <strong>ВАЖНИ (Приоритетни smetki, aktivi i operacii)</strong>
      <div id="pf-imp-accounts" class="hint" style="margin-top:8px;"></div>
      <div id="pf-imp-assets" style="margin-top:8px;"></div>
      <table>
        <thead><tr><th>Data</th><th>Deistvie</th><th>Metod</th><th>Suma</th><th>Cel</th></tr></thead>
        <tbody id="pf-imp-tx-rows"></tbody>
      </table>
    </div>

    
    <div id="tab-providers" style="display:none;" class="card">
      <strong>DOSTAVCHITSI — Registraciq i Verifikaciq (KYC / KYB / Portfeli)</strong>
      <p class="hint">Izberi dostavchik, otvori ofitsialnata stranitsa za registraciq/verifikaciq i zapazi statusa na tvoia akaund.</p>
      <div class="row" style="margin-top:8px;">
        <select id="pf-prov-id"></select>
        <select id="pf-prov-status">
          <option value="UNVERIFIED">UNVERIFIED</option>
          <option value="PENDING_KYC">PENDING_KYC</option>
          <option value="VERIFIED">VERIFIED</option>
        </select>
        <input id="pf-prov-ref" placeholder="Akaund ID / e-mail / referenciq" style="flex:1;" />
        <label class="hint"><input id="pf-prov-reg" type="checkbox" /> Registriran</label>
        <button id="pf-prov-open" type="button">Otvori registraciq</button>
        <button id="pf-prov-save" class="primary" type="button">Zapazi status</button>
      </div>
      <div id="pf-prov-list" style="margin-top:8px;"></div>
    </div>
  
    <div id="tab-trade" style="display:none;" class="card">
      <strong>Търговия и Смяна</strong>
      <div class="row" style="margin-top:8px;">
        <input id="pf-trade-pair" placeholder="Dvoika (napr. TON/USDT ili GRAM/EUR)" />
        <input id="pf-trade-amt" type="number" step="any" placeholder="Suma" />
        <button id="pf-trade-exec" class="primary" type="button">Zapischi swap</button>
      </div>
    </div>

    <div id="tab-browser" style="display:none;" class="card">
      <strong>Браузър и свързани услуги (Keeper / PayPal / Telegram)</strong>
      <div class="row" style="margin-top:8px;">
        <input id="pf-url" placeholder="https://..." style="flex:1;" />
        <button id="pf-open-url" class="primary" type="button">Otvori link</button>
      </div>
      <p class="hint">Polzvai samo ofitsialni stranici/portfeili (Keeper, PayPal, Telegram) za realni prevodi.</p>
    </div>

    <div id="tab-links" style="display:none;" class="card">
      <strong>Linkove za iskanе / plashtane kum moq portfeil</strong>
      <div class="row" style="margin-top:8px;">
        <select id="pf-link-method">
          <option value="keeper">Keeper / TON</option>
          <option value="paypal">PayPal</option>
          <option value="tg_stars">Telegram Stars (@marauderai_bot)</option>
          <option value="google_pay">Google Pay</option>
        </select>
        <input id="pf-link-handle" placeholder="TON adres, PayPal user/e-mail ili @bot" style="flex:1;" />
        <input id="pf-link-amt" type="number" step="any" placeholder="Suma (po izbor)" style="width:150px;" />
        <input id="pf-link-note" placeholder="Belejka (po izbor)" style="width:180px;" />
        <button id="pf-gen-link" class="primary" type="button">Generirai link</button>
      </div>
      <div class="row">
        <input id="pf-link-out" readonly placeholder="Tuk shte se poqvi generiraniqt link..." style="flex:1;" />
        <button id="pf-copy-link" type="button">Kopirai</button>
        <span id="pf-copy-status" class="hint"></span>
      </div>
    </div>

    <div id="tab-settings" style="display:none;" class="card">
      <strong>Настройки (Профил, Валута, Сигурност, Възстановяване)</strong>
      <div class="row" style="margin-top:8px;">
        <input id="pf-set-name" placeholder="Ime na profila" />
        <select id="pf-set-currency">
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
          <option value="BGN">BGN</option>
        </select>
        <select id="pf-set-search">
          <option value="DuckDuckGo">DuckDuckGo</option>
          <option value="Brave">Brave</option>
          <option value="Google">Google</option>
        </select>
        <button id="pf-save-set" class="primary" type="button">Zapazi nastroikite</button>
      </div>
      <div class="row">
        <input id="pf-recovery" type="password" placeholder="Fraza za vuzstanovqvane (samo lokalno)" style="flex:1;" />
        <button id="pf-clear-recovery" type="button">Izchisti poleto</button>
      </div>
    </div>

    <div class="tabs">
      <button data-tab="portfolio" class="primary" type="button">Портфейл</button>
      <button data-tab="important" type="button">Vajni</button>
      <button data-tab="providers" type="button">Dostavchitsi</button>
      <button data-tab="trade" type="button">Търговия</button>
      <button data-tab="browser" type="button">Браузър</button>
      <button data-tab="links" type="button">Linkove</button>
      <button data-tab="settings" type="button">Настройки</button>
    </div>
  </div>
  <script>
    const API = ${JSON.stringify(apiBase)};
    let currentState = null;

    function fmtNum(n, hidden) {
      return hidden ? "***" : String(n ?? 0);
    }

    function buildPaymentRequestLink(method, handle, amount, note) {
      const cleanHandle = String(handle || "").trim();
      const numAmt = Number(amount);
      const hasAmt = Number.isFinite(numAmt) && numAmt > 0;
      const cleanNote = String(note || "").trim();
      if (method === "paypal") {
        const slug = cleanHandle.replace(/^https?:\\/\\/(www\\.)?paypal\\.me\\//i, "").replace(/^@/, "");
        if (!slug) return "";
        return hasAmt
          ? "https://www.paypal.com/paypalme/" + encodeURIComponent(slug) + "/" + encodeURIComponent(String(numAmt))
          : "https://www.paypal.com/paypalme/" + encodeURIComponent(slug);
      }
      if (method === "keeper" || method === "ton") {
        if (!cleanHandle) return "";
        const params = new URLSearchParams();
        if (hasAmt) params.set("amount", String(Math.round(numAmt * 1e9)));
        if (cleanNote) params.set("text", cleanNote);
        const qs = params.toString();
        return "ton://transfer/" + encodeURIComponent(cleanHandle) + (qs ? "?" + qs : "");
      }
      if (method === "google_pay") {
        return "gpay://checkout?amount=" + encodeURIComponent(String(numAmt || 0)) + "&note=" + encodeURIComponent(cleanNote || "MARAUDER");
      }
      if (method === "tg_stars") {
        const bot = (cleanHandle || "marauderai_bot").replace(/^@/, "");
        const payload = "pay_stars_" + (hasAmt ? numAmt : "custom") + (cleanNote ? "_" + cleanNote.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32) : "");
        return "https://t.me/" + encodeURIComponent(bot) + "?start=" + encodeURIComponent(payload);
      }
      return "";
    }

    async function load() {
      const r = await fetch(API);
      const d = await r.json();
      if (!d.ok) return;
      currentState = d;
      renderProvidersSection(d);
      renderKycSummary(d);
      renderAccountsOverview(d);
      renderIssuerSection(d);
      renderVcardSection(d);
      const hidden = Boolean(d.walletMeta && d.walletMeta.hideBalances);
      document.getElementById("pf-title").textContent = "Портфейл — " + (d.ownerProfile?.displayName || "Dani");
      document.getElementById("pf-addr").textContent = d.walletMeta?.shortAddress || "UQBO...T_7H";
      document.getElementById("pf-set-name").value = d.ownerProfile?.displayName || "";
      document.getElementById("pf-set-currency").value = d.ownerProfile?.currency || "EUR";
      document.getElementById("pf-set-search").value = d.ownerProfile?.searchEngine || "DuckDuckGo";

      const accounts = d.accounts || [];
      document.getElementById("pf-acc-list").textContent = accounts
        .map(a => (a.important ? "[VAJNA] " : "") + a.label + ": " + fmtNum(a.balance, hidden) + " " + a.currency + (a.handleOrAddress ? " [" + a.handleOrAddress + "]" : ""))
        .join("  |  ");

      const assets = d.assets || [];
      document.getElementById("pf-assets-list").innerHTML = assets.map(a =>
        '<div class="asset-item"><span>' + (a.important ? "★ " : "") + '<strong>' + a.symbol + '</strong> (' + a.name + ')</span><span>' +
        fmtNum(a.balance, hidden) + ' | ' + fmtNum(a.fiatEur, hidden) + ' ' + (d.ownerProfile?.currency || "EUR") +
        ' (' + (a.changePct >= 0 ? "+" : "") + a.changePct + '%)</span></div>'
      ).join("");

      const txs = d.transfers || [];
      document.getElementById("pf-tx-rows").innerHTML = txs.map(t =>
        '<tr><td>' + t.createdAt + '</td><td>' + (t.important ? "★" : "-") + '</td><td>' + t.action + '</td><td>' + t.method + '</td><td>' +
        t.amount + ' ' + t.currency + '</td><td>' + t.recipient + '</td><td>' + t.status + '</td></tr>'
      ).join("");

      document.getElementById("pf-imp-accounts").textContent = "Vajni smetki: " + accounts.filter(a => a.important).map(a => a.label + " (" + fmtNum(a.balance, hidden) + " " + a.currency + ")").join(" | ");
      document.getElementById("pf-imp-assets").innerHTML = assets.filter(a => a.important).map(a =>
        '<div class="asset-item"><span>★ <strong>' + a.symbol + '</strong></span><span>' + fmtNum(a.balance, hidden) + '</span></div>'
      ).join("");
      document.getElementById("pf-imp-tx-rows").innerHTML = txs.filter(t => t.important).map(t =>
        '<tr><td>' + t.createdAt + '</td><td>' + t.action + '</td><td>' + t.method + '</td><td>' + t.amount + ' ' + t.currency + '</td><td>' + t.recipient + '</td></tr>'
      ).join("");
    }

    document.querySelectorAll("[data-tab]").forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        ["portfolio", "important", "providers", "trade", "browser", "links", "settings"].forEach(t => {
          document.getElementById("tab-" + t).style.display = (t === tab) ? "block" : "none";
        });
      });
    });

    document.querySelectorAll("[data-act]").forEach(btn => {
      btn.addEventListener("click", () => {
        document.getElementById("pf-tx-action").value = btn.getAttribute("data-act");
        document.getElementById("pf-tx-amount").focus();
      });
    });

    document.getElementById("pf-toggle-hide").addEventListener("click", async () => {
      const nextHide = !(currentState && currentState.walletMeta && currentState.walletMeta.hideBalances);
      await fetch(API + "/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hideBalances: nextHide })
      });
      
    let providersList = [];
    let enrollmentsMap = {};

    function renderProvidersSection(state) {
      providersList = state.providersCatalog || [];
      enrollmentsMap = state.providerEnrollments || {};
      const sel = document.getElementById("pf-prov-id");
      if (sel && sel.options.length !== providersList.length) {
        sel.innerHTML = providersList.map(p =>
          "<option value="" + p.id + "">" + p.name + " (" + p.category + ")</option>"
        ).join("");
      }
      const curId = sel ? sel.value : (providersList[0] && providersList[0].id);
      const enr = (curId && enrollmentsMap[curId]) || { registered: false, verificationStatus: "UNVERIFIED", accountRef: "" };
      if (document.getElementById("pf-prov-status")) document.getElementById("pf-prov-status").value = enr.verificationStatus || "UNVERIFIED";
      if (document.getElementById("pf-prov-ref")) document.getElementById("pf-prov-ref").value = enr.accountRef || "";
      if (document.getElementById("pf-prov-reg")) document.getElementById("pf-prov-reg").checked = Boolean(enr.registered);

      const listEl = document.getElementById("pf-prov-list");
      if (listEl) {
        listEl.innerHTML = providersList.map(p => {
          const itemEnr = enrollmentsMap[p.id] || {};
          const st = itemEnr.verificationStatus || "UNVERIFIED";
          const regTxt = itemEnr.registered ? "REG: YES" : "REG: NO";
          return "<div class="asset-item"><span><strong>" + p.name + "</strong> — " + p.verificationMode + "</span>" +
            "<span>[" + regTxt + " | " + st + "] <a href="" + p.registerUrl + "" target="_blank" rel="noopener noreferrer" style="color:#8ab4f8;">Registraciq</a></span></div>";
        }).join("");
      }
    }

    if (document.getElementById("pf-prov-id")) {
      document.getElementById("pf-prov-id").addEventListener("change", () => {
        if (currentState) renderProvidersSection(currentState);
      });
    }

    if (document.getElementById("pf-prov-open")) {
      document.getElementById("pf-prov-open").addEventListener("click", () => {
        const id = document.getElementById("pf-prov-id").value;
        const found = providersList.find(p => p.id === id);
        if (found && found.registerUrl) {
          window.open(found.registerUrl, "_blank", "noopener,noreferrer");
        }
      });
    }

    if (document.getElementById("pf-prov-save")) {
      document.getElementById("pf-prov-save").addEventListener("click", async () => {
        await fetch(API + "/provider-enrollment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerId: document.getElementById("pf-prov-id").value,
            verificationStatus: document.getElementById("pf-prov-status").value,
            accountRef: document.getElementById("pf-prov-ref").value,
            registered: document.getElementById("pf-prov-reg").checked
          })
        });
        
    function renderKycSummary(state) {
      const op = (state && state.ownerProfile) || {};
      const prov = op.authProvider || "local";
      const handle = op.clientHandle || "-";
      const st = op.kycStatus || (op.kycVerified ? "VERIFIED" : "NONE");
      const el = document.getElementById("pf-kyc-summary");
      if (document.getElementById("pf-auth-provider")) document.getElementById("pf-auth-provider").value = ["gmail", "github", "registration"].includes(prov) ? prov : "gmail";
      if (document.getElementById("pf-client-handle")) document.getElementById("pf-client-handle").value = handle === "-" ? "" : handle;
      if (document.getElementById("pf-kyc-status")) document.getElementById("pf-kyc-status").value = ["NONE", "PENDING", "VERIFIED"].includes(st) ? st : "NONE";
      if (el) {
        el.textContent = "Активен вход: " + prov + " (" + handle + ") | Верификация: " + st + (st === "VERIFIED" ? " [Потвърден]" : " [Изисква пълна верификация за карта]");
      }
    }

    if (document.getElementById("pf-kyc-save")) {
      document.getElementById("pf-kyc-save").addEventListener("click", async () => {
        await fetch(API + "/client-kyc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authProvider: document.getElementById("pf-auth-provider").value,
            clientHandle: document.getElementById("pf-client-handle").value,
            kycStatus: document.getElementById("pf-kyc-status").value
          })
        });
        
    function renderIssuerSection(state) {
      const op = (state && state.ownerProfile) || {};
      const wm = (state && state.walletMeta) || {};
      const isVerified = Boolean(op.kycVerified) || String(op.kycStatus || "").toUpperCase() === "VERIFIED";
      const warnEl = document.getElementById("pf-issuer-warning");
      const sumEl = document.getElementById("pf-issuer-summary");

      if (warnEl) {
        warnEl.textContent = isVerified
          ? ""
          : "Предупреждение: Профилът няма статус VERIFIED. Конфигурирането на карта е блокирано докато статусът не стане VERIFIED.";
      }

      if (wm.cardIssuer && document.getElementById("pf-issuer-provider")) {
        document.getElementById("pf-issuer-provider").value = wm.cardIssuer.provider || "";
      }
      if (wm.cardIssuer && document.getElementById("pf-issuer-ref")) {
        document.getElementById("pf-issuer-ref").value = wm.cardIssuer.cardRef || "";
      }
      if (wm.cardIssuer && document.getElementById("pf-issuer-last4")) {
        document.getElementById("pf-issuer-last4").value = wm.cardIssuer.last4 || "";
      }
      if (wm.cardIssuer && document.getElementById("pf-issuer-gwallet")) {
        document.getElementById("pf-issuer-gwallet").checked = Boolean(wm.cardIssuer.googleWalletEligible);
      }

      if (sumEl) {
        if (wm.cardIssuer && (wm.cardIssuer.provider || wm.cardIssuer.cardRef || wm.cardIssuer.last4)) {
          sumEl.textContent = "Записан издател: " + (wm.cardIssuer.provider || "-") +
            " | Ref: " + (wm.cardIssuer.cardRef || "-") +
            " | Last4: " + (wm.cardIssuer.last4 || "----") +
            " | Google Wallet: " + (wm.cardIssuer.googleWalletEligible ? "DA" : "NE");
        } else {
          sumEl.textContent = "Няма записана конфигурация на карта/издател.";
        }
      }
    }

    if (document.getElementById("pf-issuer-save")) {
      document.getElementById("pf-issuer-save").addEventListener("click", async () => {
        const op = (currentState && currentState.ownerProfile) || {};
        const isVerified = Boolean(op.kycVerified) || String(op.kycStatus || "").toUpperCase() === "VERIFIED";
        const warnEl = document.getElementById("pf-issuer-warning");
        if (!isVerified) {
          if (warnEl) {
            warnEl.textContent = "Внимание: Нямаш статус VERIFIED! Първо избери VERIFIED и натисни Запази вход и статус.";
          }
          return;
        }

        const resp = await fetch(API + "/issuer-config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: document.getElementById("pf-issuer-provider").value,
            cardRef: document.getElementById("pf-issuer-ref").value,
            last4: document.getElementById("pf-issuer-last4").value,
            googleWalletEligible: document.getElementById("pf-issuer-gwallet").checked
          })
        });
        const out = await resp.json();
        if (!out.ok && warnEl) {
          warnEl.textContent = "Отказ от сървъра: " + (out.error || "ISSUER_CONFIG_REJECTED");
        }
        
    function renderVcardSection(state) {
      const op = (state && state.ownerProfile) || {};
      const wm = (state && state.walletMeta) || {};
      const isVerified = Boolean(op.kycVerified) || String(op.kycStatus || "").toUpperCase() === "VERIFIED";
      const warnEl = document.getElementById("pf-vcard-warning");
      const sumEl = document.getElementById("pf-vcard-summary");

      if (warnEl) {
        warnEl.textContent = isVerified
          ? ""
          : "Предупреждение: Профилът няма статус VERIFIED. Потвърди статуса VERIFIED преди да генерираш нов референтен профил.";
      }

      if (sumEl) {
        if (wm.virtualCard && wm.virtualCard.maskedRef) {
          sumEl.textContent = "Текущ референтен профил: " + (wm.virtualCard.label || "Profile") +
            " | " + wm.virtualCard.maskedRef +
            " | Exp ref: " + (wm.virtualCard.expiryRef || "--/--");
        } else {
          sumEl.textContent = "Няма генериран вътрешен референтен профил.";
        }
      }
    }

    if (document.getElementById("pf-vcard-gen")) {
      document.getElementById("pf-vcard-gen").addEventListener("click", async () => {
        const op = (currentState && currentState.ownerProfile) || {};
        const isVerified = Boolean(op.kycVerified) || String(op.kycStatus || "").toUpperCase() === "VERIFIED";
        const warnEl = document.getElementById("pf-vcard-warning");
        if (!isVerified) {
          if (warnEl) {
            warnEl.textContent = "Внимание: Нямаш статус VERIFIED! Първо избери VERIFIED и натисни Запази вход и статус.";
          }
          return;
        }

        const resp = await fetch(API + "/virtual-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: document.getElementById("pf-vcard-label").value || "MARAUDER Reference Profile"
          })
        });
        const out = await resp.json();
        if (!out.ok && warnEl) {
          warnEl.textContent = "Грешка при генериране: " + (out.error || "VIRTUAL_CARD_FAILED");
        }
        
    function getSavedAccountHandle(state, accountId) {
      const list = (state && state.accounts) || [];
      const found = list.find(a => a.id === accountId);
      return found && found.handleOrAddress ? String(found.handleOrAddress).trim() : "";
    }

    function openDirectChannel(channel) {
      if (channel === "paypal") {
        const statusEl = document.getElementById("pf-direct-status");
        const url = "https://www.paypal.com/ncp/payment/RPTDVVN5XA4XC";
        if (statusEl) statusEl.textContent = "Отварям PayPal: " + url;
        if (document.getElementById("pf-link-out")) document.getElementById("pf-link-out").value = url;
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
      const statusEl = document.getElementById("pf-direct-status");
      const amtRaw = document.getElementById("pf-direct-amt") ? document.getElementById("pf-direct-amt").value : "";
      const noteRaw = document.getElementById("pf-direct-note") ? document.getElementById("pf-direct-note").value : "";
      const inputHandle = document.getElementById("pf-link-handle") ? document.getElementById("pf-link-handle").value.trim() : "";
      const savedHandle = getSavedAccountHandle(currentState, channel === "paypal" ? "paypal" : "keeper");
      const addrEl = document.getElementById("pf-addr");
      const fallbackTon = (addrEl && addrEl.textContent && !addrEl.textContent.includes("...")) ? addrEl.textContent.trim() : "";

      const handle = inputHandle || savedHandle || (channel === "keeper" ? fallbackTon : "");
      const url = buildPaymentRequestLink(channel, handle, amtRaw, noteRaw);

      if (!url) {
        if (statusEl) {
          statusEl.textContent = channel === "paypal"
            ? "Липсва PayPal профил/име. Попълни го в сметката PayPal или в полето за линк."
            : "Липсва валиден TON адрес. Попълни го в сметката Keeper / TON или в полето за линк.";
        }
        return;
      }

      if (statusEl) {
        statusEl.textContent = "Отварям поток (" + channel + "): " + url;
      }
      if (document.getElementById("pf-link-out")) {
        document.getElementById("pf-link-out").value = url;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    }

    if (document.getElementById("pf-direct-paypal-btn")) {
      document.getElementById("pf-direct-paypal-btn").addEventListener("click", () => openDirectChannel("paypal"));
    }
    if (document.getElementById("pf-direct-keeper-btn")) {
      document.getElementById("pf-direct-keeper-btn").addEventListener("click", () => openDirectChannel("keeper"));
    }
  
    
    function switchPortfolioTab(tabName) {
      ["portfolio", "important", "providers", "trade", "browser", "links", "settings"].forEach(t => {
        const el = document.getElementById("tab-" + t);
        if (el) el.style.display = (t === tabName) ? "block" : "none";
      });
    }

    async function copyGeneratedLinkWithFeedback(text) {
      const copyStatusEl = document.getElementById("pf-copy-status");
      const outEl = document.getElementById("pf-link-out");
      const val = String(text || (outEl && outEl.value) || "").trim();
      if (!val || val.startsWith("Vuvedi validen")) {
        if (copyStatusEl) copyStatusEl.textContent = "Няма валиден линк за копиране.";
        return false;
      }

      let copied = false;
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        try {
          await navigator.clipboard.writeText(val);
          copied = true;
        } catch (_) {
          copied = false;
        }
      }

      if (!copied && outEl) {
        try {
          outEl.focus();
          outEl.select();
          copied = Boolean(document.execCommand && document.execCommand("copy"));
        } catch (_) {
          copied = false;
        }
      }

      if (copyStatusEl) {
        copyStatusEl.textContent = copied
          ? "✓ Линкът е копиран в клипборда."
          : "Неуспешно автоматично копиране — маркирай и копирай ръчно.";
      }
      return copied;
    }

    if (document.getElementById("pf-open-links-tab-btn")) {
      document.getElementById("pf-open-links-tab-btn").addEventListener("click", () => {
        const amtRaw = document.getElementById("pf-direct-amt") ? document.getElementById("pf-direct-amt").value : "";
        const noteRaw = document.getElementById("pf-direct-note") ? document.getElementById("pf-direct-note").value : "";
        const inputHandle = document.getElementById("pf-link-handle") ? document.getElementById("pf-link-handle").value.trim() : "";
        const savedKeeper = getSavedAccountHandle(currentState, "keeper");
        const savedPaypal = getSavedAccountHandle(currentState, "paypal");
        const activeMethod = document.getElementById("pf-link-method") ? document.getElementById("pf-link-method").value : "keeper";
        const candidateHandle = inputHandle || (activeMethod === "paypal" ? savedPaypal : savedKeeper) || savedKeeper || savedPaypal;
        const chosenMethod = inputHandle
          ? activeMethod
          : (savedKeeper && activeMethod !== "paypal" ? "keeper" : (savedPaypal ? "paypal" : activeMethod));

        if (document.getElementById("pf-link-method")) document.getElementById("pf-link-method").value = chosenMethod;
        if (document.getElementById("pf-link-handle") && candidateHandle) document.getElementById("pf-link-handle").value = candidateHandle;
        if (document.getElementById("pf-link-amt") && amtRaw) document.getElementById("pf-link-amt").value = amtRaw;
        if (document.getElementById("pf-link-note") && noteRaw) document.getElementById("pf-link-note").value = noteRaw;

        const built = buildPaymentRequestLink(chosenMethod, candidateHandle, amtRaw, noteRaw);
        if (built && document.getElementById("pf-link-out")) {
          document.getElementById("pf-link-out").value = built;
        }
        switchPortfolioTab("links");
      });
    }

    const pfCopyBtn = document.getElementById("pf-copy-link");
    if (pfCopyBtn) {
      const freshCopyBtn = pfCopyBtn.cloneNode(true);
      pfCopyBtn.parentNode.replaceChild(freshCopyBtn, pfCopyBtn);
      freshCopyBtn.addEventListener("click", () => {
        const val = document.getElementById("pf-link-out") ? document.getElementById("pf-link-out").value : "";
        copyGeneratedLinkWithFeedback(val);
      });
    }
  
    
    if (document.getElementById("pf-show-qr-btn")) {
      document.getElementById("pf-show-qr-btn").addEventListener("click", async () => {
        const amt = document.getElementById("pf-direct-amt") ? document.getElementById("pf-direct-amt").value : "";
        const note = document.getElementById("pf-direct-note") ? document.getElementById("pf-direct-note").value : "";
        const qs = new URLSearchParams();
        if (amt) qs.set("amount", amt);
        if (note) qs.set("note", note);
        const qrApiUrl = API + "/qr" + (qs.toString() ? "?" + qs.toString() : "");
        const resp = await fetch(qrApiUrl);
        const data = await resp.json();
        const panel = document.getElementById("pf-qr-panel");
        const urlEl = document.getElementById("pf-qr-url");
        const wrapEl = document.getElementById("pf-qr-svg-wrap");
        if (data && data.ok && panel && urlEl && wrapEl) {
          urlEl.textContent = "QR URL (сканирай с друго устройство): " + data.targetUrl;
          wrapEl.innerHTML = data.svg;
          panel.style.display = "block";
        }
      });
    }
  
    
    function renderAccountsOverview(state) {
      const box = document.getElementById("pf-accounts-overview-list");
      if (!box) return;
      const list = Array.isArray(state && state.accounts) ? state.accounts : [];
      if (!list.length) {
        box.textContent = "Няма добавени сметки.";
        return;
      }
      box.innerHTML = list.map((acc) => {
        const activeLabel = acc.active === false ? "Неактивна" : "Активна";
        const handle = acc.handleOrAddress ? String(acc.handleOrAddress) : "не е зададен";
        const bal = acc.balance !== undefined && acc.balance !== null ? acc.balance : 0;
        const cur = acc.currency || "";
        return "<div style=\"padding:6px 0;border-bottom:1px solid #22324c;\">" +
          "<strong>" + (acc.label || acc.id || "Сметка") + "</strong> — " +
          "<span>Статус: " + activeLabel + "</span> | " +
          "<span>Баланс: " + bal + (cur ? " " + cur : "") + "</span> | " +
          "<span>Адрес/профил: <code>" + handle + "</code></span>" +
          "</div>";
      }).join("");
    }
  
    load();
      });
    }
  
    load();
      });
    }
  
    load();
      });
    }
  
    load();
      });
    }
  
    load();
    });

    document.getElementById("pf-lock-btn").addEventListener("click", () => {
      document.getElementById("pf-recovery").value = "";
      alert("Сесията е заключена локално.");
    });

    document.getElementById("pf-save-acc").addEventListener("click", async () => {
      await fetch(API + "/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: document.getElementById("pf-acc-id").value,
          handleOrAddress: document.getElementById("pf-acc-handle").value,
          balance: Number(document.getElementById("pf-acc-bal").value || 0),
          important: document.getElementById("pf-acc-imp").checked,
          active: true
        })
      });
      load();
    });

    document.getElementById("pf-save-asset").addEventListener("click", async () => {
      await fetch(API + "/asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: document.getElementById("pf-asset-sym").value,
          balance: Number(document.getElementById("pf-asset-bal").value || 0),
          fiatEur: Number(document.getElementById("pf-asset-eur").value || 0),
          important: document.getElementById("pf-asset-imp").checked
        })
      });
      load();
    });

    document.getElementById("pf-run-tx").addEventListener("click", async () => {
      await fetch(API + "/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: document.getElementById("pf-tx-action").value,
          method: document.getElementById("pf-tx-method").value,
          amount: Number(document.getElementById("pf-tx-amount").value || 0),
          recipient: document.getElementById("pf-tx-target").value,
          important: document.getElementById("pf-tx-imp").checked
        })
      });
      load();
    });

    document.getElementById("pf-trade-exec").addEventListener("click", async () => {
      await fetch(API + "/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "swap",
          method: "crypto",
          amount: Number(document.getElementById("pf-trade-amt").value || 0),
          recipient: document.getElementById("pf-trade-pair").value
        })
      });
      load();
    });

    document.getElementById("pf-open-url").addEventListener("click", () => {
      const u = document.getElementById("pf-url").value.trim();
      if (/^https?:\/\//i.test(u)) window.open(u, "_blank", "noopener,noreferrer");
    });

    document.getElementById("pf-gen-link").addEventListener("click", () => {
      const out = buildPaymentRequestLink(
        document.getElementById("pf-link-method").value,
        document.getElementById("pf-link-handle").value,
        document.getElementById("pf-link-amt").value,
        document.getElementById("pf-link-note").value
      );
      document.getElementById("pf-link-out").value = out || "Vuvedi validen adres / profil / bot.";
    });

    document.getElementById("pf-copy-link").addEventListener("click", async () => {
      const val = document.getElementById("pf-link-out").value;
      if (!val) return;
      try { await navigator.clipboard.writeText(val); } catch (_) {}
    });

    document.getElementById("pf-save-set").addEventListener("click", async () => {
      await fetch(API + "/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: document.getElementById("pf-set-name").value,
          currency: document.getElementById("pf-set-currency").value,
          searchEngine: document.getElementById("pf-set-search").value
        })
      });
      load();
    });

    document.getElementById("pf-clear-recovery").addEventListener("click", () => {
      document.getElementById("pf-recovery").value = "";
    });

    load();
  </script>
</body>
</html>`;
}

function mountPortfolioButton(container, portfolioUrl = "/portfolio") {
  if (!container) return null;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "btn-realen-portfeil";
  btn.textContent = "[ PORTOFEIL ]";
  btn.style.cssText = "background:#182436;color:#e6edf3;border:1px solid #58a6ff;padding:6px 12px;font-family:monospace;font-weight:700;cursor:pointer;border-radius:5px;";
  btn.addEventListener("click", () => {
    window.open(portfolioUrl, "_blank", "noopener,noreferrer");
  });
  container.appendChild(btn);
  return btn;
}

module.exports = { renderPortfolioPageHtml, mountPortfolioButton };
