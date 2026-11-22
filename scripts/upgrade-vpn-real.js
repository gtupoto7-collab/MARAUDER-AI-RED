const fs = require("fs");
const path = require("path");

const pubDir = path.join(__dirname, "..", "public");
if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });

const vpnPage = `<!doctype html>
<html lang="bg">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>VPN & Orbot Shield — MARAUDER</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: monospace; background: #09090b; color: #f4f4f5; margin: 0; padding: 16px; line-height: 1.5; }
    .box { max-width: 980px; margin: 0 auto; background: #111115; border: 1px solid #c084fc; border-radius: 10px; padding: 16px; }
    .top { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid #27272a; padding-bottom: 10px; margin-bottom: 14px; }
    .top a { color: #38bdf8; text-decoration: none; margin-right: 10px; font-size: 12px; }
    .top a:hover { text-decoration: underline; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-bottom: 12px; }
    label { display: block; font-size: 12px; color: #d4d4d8; margin-bottom: 4px; }
    input, select { width: 100%; padding: 8px 10px; border-radius: 6px; border: 1px solid #52525b; background: #09090b; color: #fff; font-family: monospace; font-size: 13px; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    button { padding: 8px 12px; border-radius: 6px; border: 1px solid #52525b; background: #18181b; color: #fff; font-family: monospace; font-size: 12px; font-weight: bold; cursor: pointer; }
    button.primary { border-color: #22c55e; background: #14532d; color: #dcfce7; }
    button.purple { border-color: #c084fc; background: #3b0764; color: #f3e8ff; }
    button.warn { border-color: #ef4444; background: #450a0a; color: #fecaca; }
    pre { background: #09090b; border: 1px solid #27272a; padding: 12px; border-radius: 8px; white-space: pre-wrap; word-break: break-word; font-size: 12px; }
    .note { background: #18181b; border-left: 3px solid #f59e0b; padding: 10px 12px; border-radius: 6px; font-size: 12px; color: #e4e4e7; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="top">
      <h2 style="margin:0;color:#c084fc;">VPN &amp; Orbot Connection Shield</h2>
      <div>
        <a href="/index.html">Начало</a>
        <a href="/kali-root.html">Linux Конзола</a>
        <a href="/devanport-studio.html">DEVANPORT-AI</a>
        <a href="/bot-studio.html">BOT Studio</a>
        <a href="/payments-plans.html">Плащания</a>
      </div>
    </div>

    <div class="note">
      <strong>Важно:</strong> Уеб страница в браузър не може сама да стартира системен VPN на Android/iOS/Windows. Първо включи <strong>Orbot</strong> или твоя <strong>VPN</strong> на устройството, задай профила тук и провери връзката, за да се вижда IP-то на VPN/Tor изхода, а не директния ти адрес.
    </div>

    <div class="grid">
      <div>
        <label for="devOsSel">Устройство / Платформа</label>
        <select id="devOsSel">
          <option value="Android">Android (Orbot / VPN приложение)</option>
          <option value="iOS">iOS (Orbot / VPN приложение)</option>
          <option value="Windows">Windows (VPN / Tor / Proxy)</option>
          <option value="Linux/Termux">Linux / Termux</option>
        </select>
      </div>
      <div>
        <label for="vpnMethodSel">Режим на свързване</label>
        <select id="vpnMethodSel">
          <option value="orbot-socks5">Orbot / Tor SOCKS5</option>
          <option value="device-vpn">Системен VPN на устройството</option>
          <option value="custom-proxy">Потребителски Proxy (SOCKS5 / HTTP)</option>
        </select>
      </div>
      <div>
        <label for="proxyEndpointInp">Proxy / Orbot адрес (Host:Port)</label>
        <input id="proxyEndpointInp" type="text" placeholder="напр. 127.0.0.1:9050" />
      </div>
    </div>

    <div class="actions">
      <button type="button" id="saveVpnProfileBtn" class="primary">Активирай и Запази VPN Профил</button>
      <button type="button" id="checkIpBtn" class="purple">Провери Външен IP / Връзка</button>
      <button type="button" id="disableVpnBtn" class="warn">Изключи Профила</button>
    </div>

    <pre id="vpnStatusLog">Зареждане на VPN конфигурацията...</pre>
  </div>

  <script>
    (function(){
      var KEY = "marauder_vpn_shield_v1";
      var osSel = document.getElementById("devOsSel");
      var methodSel = document.getElementById("vpnMethodSel");
      var epInp = document.getElementById("proxyEndpointInp");
      var saveBtn = document.getElementById("saveVpnProfileBtn");
      var checkBtn = document.getElementById("checkIpBtn");
      var offBtn = document.getElementById("disableVpnBtn");
      var logEl = document.getElementById("vpnStatusLog");

      var lastIpInfo = "Не е проверявано още.";

      function loadCfg() {
        try {
          var raw = JSON.parse(localStorage.getItem(KEY) || "{}");
          return {
            os: raw.os || "Android",
            method: raw.method || "orbot-socks5",
            endpoint: raw.endpoint || "127.0.0.1:9050",
            enabled: !!raw.enabled,
            updatedAt: raw.updatedAt || ""
          };
        } catch (_) {
          return { os: "Android", method: "orbot-socks5", endpoint: "127.0.0.1:9050", enabled: false, updatedAt: "" };
        }
      }

      function saveCfg(cfg) {
        try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (_) {}
      }

      function applyToInputs(cfg) {
        if (osSel) osSel.value = cfg.os;
        if (methodSel) methodSel.value = cfg.method;
        if (epInp) epInp.value = cfg.endpoint;
      }

      function render() {
        var cfg = loadCfg();
        logEl.textContent = [
          "Статус на профила: " + (cfg.enabled ? "АКТИВЕН" : "ИЗКЛЮЧЕН"),
          "Устройство: " + cfg.os,
          "Режим: " + cfg.method,
          "Endpoint: " + (cfg.endpoint || "(не е зададен)"),
          "Последна промяна: " + (cfg.updatedAt || "няма"),
          "--- Проверка на външен IP ---",
          lastIpInfo
        ].join("\\n");
      }

      saveBtn.addEventListener("click", function(){
        var cfg = {
          os: osSel ? osSel.value : "Android",
          method: methodSel ? methodSel.value : "orbot-socks5",
          endpoint: (epInp && epInp.value || "").trim() || "127.0.0.1:9050",
          enabled: true,
          updatedAt: new Date().toLocaleString()
        };
        saveCfg(cfg);
        render();
      });

      offBtn.addEventListener("click", function(){
        var cfg = loadCfg();
        cfg.enabled = false;
        cfg.updatedAt = new Date().toLocaleString();
        saveCfg(cfg);
        render();
      });

      checkBtn.addEventListener("click", async function(){
        lastIpInfo = "Проверява се външният IP адрес през текущата мрежа/VPN...";
        render();
        try {
          var ctrl = new AbortController();
          var t = setTimeout(function(){ ctrl.abort(); }, 6000);
          var r = await fetch("https://api.ipify.org?format=json", { signal: ctrl.signal });
          clearTimeout(t);
          if (!r.ok) throw new Error("HTTP " + r.status);
          var d = await r.json();
          lastIpInfo = "Видим външен IP: " + (d.ip || "неизвестен") + " (проверено в " + new Date().toLocaleTimeString() + ")";
        } catch (e) {
          lastIpInfo = "Неуспешна проверка на външен IP (" + (e && e.message ? e.message : "грешка/блокирана мрежа") + "). Провери дали Orbot/VPN е включен на устройството.";
        }
        render();
      });

      var initial = loadCfg();
      applyToInputs(initial);
      render();
    })();
  </script>

<div id="marauder-full-bot-builder" style="margin-top:14px;padding:12px;border:1px solid #22c55e;border-radius:10px;background:#0b1318;">
  <div style="font-weight:700;margin-bottom:8px;color:#4ade80;">Pulen Syzdatel na Botove (TG / WhatsApp / Discord / Web / Mail / Custom)</div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;">
    <select id="mfb-platform"><option value="Telegram">Telegram Bot</option><option value="Discord">Discord Bot</option><option value="WhatsApp">WhatsApp Bot</option><option value="WebWidget">Web Chat Bot</option><option value="EmailAuto">Email Auto-Bot</option><option value="CustomAPI">Custom Webhook Bot</option></select>
    <input id="mfb-name" type="text" placeholder="Ime na bota (napr. brokerfree_bot)" />
    <input id="mfb-role" type="text" placeholder="Nisha / Cel (napr. Imoti, Avtochasti, Poddruzhka)" />
    <input id="mfb-token" type="text" placeholder="Token / Webhook URL (po jelanie)" />
    <input id="mfb-cmds" type="text" placeholder="Komandi (napr. /start, /help, /cena, /kontakt)" />
    <input id="mfb-lang" type="text" placeholder="Ezik i ton (napr. BG, barz i konkreten)" />
  </div>
  <div style="margin-top:8px;">
    <textarea id="mfb-desc" rows="2" placeholder="Pulno opisanie i logika na bota: kak posreshta klienta, kakvi danni sybira i kak otgovarya..." style="width:100%;box-sizing:border-box;"></textarea>
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
    <button type="button" id="mfb-create-btn">Suzdai i Zapazi Bota</button>
    <button type="button" id="mfb-copy-json">Kopirai Konfig JSON</button>
    <button type="button" id="mfb-clear-btn">Izchisti Spisyka</button>
  </div>
  <div id="mfb-list" style="margin-top:10px;font-size:12px;"></div>
</div>
<script id="MARAUDER_FULL_BOT_BUILDER_JS">
(function(){
  const KEY = "marauder_full_bots_v1";
  function readBots(){ try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch(_) { return []; } }
  function writeBots(v){ try { localStorage.setItem(KEY, JSON.stringify(v.slice(0, 60))); } catch(_) {} }
  function render(){
    const el = document.getElementById("mfb-list");
    if (!el) return;
    const bots = readBots();
    if (!bots.length) { el.innerHTML = "<div style=\"opacity:.75\">Nqma suzdadeni botove s pulna konfiguraciya oshte.</div>"; return; }
    el.innerHTML = bots.map((b, i) =>
      "<div style=\"padding:8px;border:1px solid #1e293b;border-radius:8px;margin-bottom:6px;background:#090e17;\">" +
      "<div><strong>#" + (i+1) + " [" + b.platform + "] " + b.name + "</strong> — <span>" + b.role + "</span> (" + b.lang + ")</div>" +
      "<div style=\"opacity:.85;margin-top:3px;\">Komandi: " + b.cmds + " | Token/Hook: " + (b.token ? "zadaden" : "lipsva") + "</div>" +
      "<div style=\"opacity:.8;margin-top:2px;\">" + b.desc + "</div>" +
      "</div>"
    ).join("");
  }
  function wire(){
    render();
    const btn = document.getElementById("mfb-create-btn");
    if (btn) btn.addEventListener("click", () => {
      const name = ((document.getElementById("mfb-name")||{}).value || "").trim() || "marauder-bot";
      const platform = ((document.getElementById("mfb-platform")||{}).value || "Telegram").trim();
      const role = ((document.getElementById("mfb-role")||{}).value || "Obshta avtomatizaciya").trim();
      const token = ((document.getElementById("mfb-token")||{}).value || "").trim();
      const cmds = ((document.getElementById("mfb-cmds")||{}).value || "/start, /help").trim();
      const lang = ((document.getElementById("mfb-lang")||{}).value || "BG").trim();
      const desc = ((document.getElementById("mfb-desc")||{}).value || "Avtomatiziran bot na MARAUDER-AI").trim();
      const bots = readBots();
      bots.unshift({ platform, name, role, token, cmds, lang, desc, createdAt: new Date().toLocaleString() });
      writeBots(bots);
      render();
    });
    const copyBtn = document.getElementById("mfb-copy-json");
    if (copyBtn) copyBtn.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(JSON.stringify(readBots(), null, 2)); } catch(_) {}
    });
    const clrBtn = document.getElementById("mfb-clear-btn");
    if (clrBtn) clrBtn.addEventListener("click", () => { writeBots([]); render(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();
})();
</script>

</body>
</html>`;

fs.writeFileSync(path.join(pubDir, "orbot-vpn.html"), vpnPage, "utf8");

const idxPath = path.join(pubDir, "index.html");
if (fs.existsSync(idxPath)) {
  let idx = fs.readFileSync(idxPath, "utf8");
  idx = idx.replace(/openSeparateWindow\("\/kali-root\.html#vpn"\)/g, 'openSeparateWindow("/orbot-vpn.html")');
  fs.writeFileSync(idxPath, idx, "utf8");
}

console.log("VPN_REAL_PANEL_READY");
