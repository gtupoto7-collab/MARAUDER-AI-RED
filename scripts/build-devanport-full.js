const fs = require("fs");
const path = require("path");

const pubDir = path.join(__dirname, "..", "public");
if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });

const devHtml = `<!doctype html>
<html lang="bg">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>DEVANPORT-AI — Ready Software Studio</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: monospace; background: #09090b; color: #f4f4f5; margin: 0; padding: 16px; line-height: 1.5; }
    .wrap { max-width: 1080px; margin: 0 auto; background: #111115; border: 1px solid #f59e0b; border-radius: 10px; padding: 16px; }
    .top { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid #27272a; padding-bottom: 10px; margin-bottom: 14px; }
    .top a { color: #38bdf8; text-decoration: none; margin-right: 10px; font-size: 12px; }
    .top a:hover { text-decoration: underline; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-bottom: 10px; }
    label { display: block; font-size: 12px; color: #d4d4d8; margin-bottom: 4px; }
    input, select, textarea { width: 100%; padding: 8px 10px; border-radius: 6px; border: 1px solid #52525b; background: #09090b; color: #fff; font-family: monospace; font-size: 13px; }
    textarea.desc { min-height: 82px; resize: vertical; }
    .ops-box { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 8px; background: #09090b; border: 1px solid #27272a; border-radius: 8px; padding: 10px; margin: 10px 0; font-size: 12px; }
    .ops-box label { display: flex; align-items: center; gap: 6px; margin: 0; cursor: pointer; }
    .ops-box input[type="checkbox"] { width: auto; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    button { padding: 8px 12px; border-radius: 6px; border: 1px solid #52525b; background: #18181b; color: #fff; font-family: monospace; font-size: 12px; font-weight: bold; cursor: pointer; }
    button.gen { border-color: #22c55e; background: #14532d; color: #dcfce7; }
    button.val { border-color: #facc15; background: #422006; color: #fef08a; }
    button.run { border-color: #38bdf8; background: #0c4a6e; color: #e0f2fe; }
    button.warn { border-color: #ef4444; background: #450a0a; color: #fecaca; }
    .two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; }
    pre { background: #09090b; border: 1px solid #27272a; padding: 12px; border-radius: 8px; white-space: pre-wrap; word-break: break-word; max-height: 360px; overflow: auto; font-size: 12px; }
    .status-ok { color: #4ade80; }
    .status-err { color: #f87171; }
    .tool-item { border: 1px solid #27272a; background: #09090b; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <h2 style="margin:0;color:#fbbf24;">DEVANPORT-AI — Specification, Validator &amp; Ready Software Studio</h2>
      <div>
        <a href="/index.html">Начало</a>
        <a href="/kali-root.html">Конзола</a>
        <a href="/bot-studio.html">BOT Studio</a>
        <a href="/payments-plans.html">Планове</a>
      </div>
    </div>

    <div class="grid">
      <div>
        <label for="toolNameInp">Име на инструмента</label>
        <input id="toolNameInp" type="text" placeholder="напр. DNS Analyzer или TCP Port Audit" />
      </div>
      <div>
        <label for="toolLangSel">Език на готовия софтуер</label>
        <select id="toolLangSel">
          <option value="node">Node.js (.js)</option>
          <option value="python">Python (.py)</option>
          <option value="bash">Bash (.sh)</option>
        </select>
      </div>
      <div>
        <label for="targetInp">Тестов вход / Target (safe)</label>
        <input id="targetInp" type="text" value="example.com" />
      </div>
    </div>

    <div>
      <label for="toolDescInp">Описание на задачата (безопасна диагностика / обработка на данни)</label>
      <textarea id="toolDescInp" class="desc" placeholder="Опиши какво да проверява или обработва инструментът (напр. DNS A/AAAA/MX записи, отворени портове, HTTP статус и хедъри)..."></textarea>
    </div>

    <div class="ops-box">
      <label><input type="checkbox" class="opChk" value="dns_a" checked /> DNS A records</label>
      <label><input type="checkbox" class="opChk" value="dns_aaaa" checked /> DNS AAAA records</label>
      <label><input type="checkbox" class="opChk" value="dns_mx" checked /> DNS MX records</label>
      <label><input type="checkbox" class="opChk" value="tcp_ports" /> TCP common ports (80, 443)</label>
      <label><input type="checkbox" class="opChk" value="http_probe" /> HTTP status &amp; headers check</label>
      <label><input type="checkbox" class="opChk" value="json_report" checked /> Structured JSON report</label>
    </div>

    <div class="actions">
      <button type="button" id="genBtn" class="gen">1. Генерирай Готов Софтуер</button>
      <button type="button" id="valBtn" class="val">2. Провери (Validator)</button>
      <button type="button" id="runBtn" class="run">3. Тествай (Safe Sandbox)</button>
      <button type="button" id="dlBtn">4. Изтегли Готовия Софтуер</button>
      <button type="button" id="copyBtn">Копирай Кода</button>
      <button type="button" id="clrBtn" class="warn">Изчисти Списъка</button>
    </div>

    <div id="validatorBanner" style="font-size:12px;margin-bottom:8px;">Статус на валидатора: <span>очаква генериране</span></div>

    <div class="two-col">
      <div>
        <h3 style="margin:6px 0;color:#86efac;font-size:13px;">Генериран Изпълним Код:</h3>
        <pre id="codeOut">Избери име, операции и описание, след което натисни "1. Генерирай Готов Софтуер".</pre>
      </div>
      <div>
        <h3 style="margin:6px 0;color:#38bdf8;font-size:13px;">Спецификация &amp; Резултат от Теста:</h3>
        <pre id="testOut">{ "status": "ready_for_spec" }</pre>
      </div>
    </div>

    <h3 style="margin:14px 0 8px 0;color:#fbbf24;font-size:13px;">Запазени Готови Инструменти:</h3>
    <div id="savedList">Няма запазени инструменти.</div>
  </div>

  <script>
    (function(){
      var STORAGE_KEY = "marauder_devanport_ready_tools_v1";
      var FORBIDDEN_PATTERNS = [
        /rm\s+-rf/i,
        /mkfs/i,
        /dd\s+if=/i,
        /:\(\)\{\s*:\|:&\s*\};:/,
        /shutdown|reboot|poweroff/i,
        /eval\s*\(/i,
        /child_process\s*\.\s*exec\s*\(/i
      ];

      var nameInp = document.getElementById("toolNameInp");
      var langSel = document.getElementById("toolLangSel");
      var targetInp = document.getElementById("targetInp");
      var descInp = document.getElementById("toolDescInp");
      var genBtn = document.getElementById("genBtn");
      var valBtn = document.getElementById("valBtn");
      var runBtn = document.getElementById("runBtn");
      var dlBtn = document.getElementById("dlBtn");
      var copyBtn = document.getElementById("copyBtn");
      var clrBtn = document.getElementById("clrBtn");
      var codeOut = document.getElementById("codeOut");
      var testOut = document.getElementById("testOut");
      var valBanner = document.getElementById("validatorBanner");
      var savedList = document.getElementById("savedList");

      var currentSpec = null;
      var currentCode = "";
      var currentFile = "diagnostic-tool.js";

      function selectedOps() {
        var ops = [];
        document.querySelectorAll(".opChk").forEach(function(chk){
          if (chk.checked) ops.push(chk.value);
        });
        return ops.length ? ops : ["dns_a", "json_report"];
      }

      function buildSpec() {
        var rawName = (nameInp.value || "").trim() || "Diagnostic Analyzer";
        var lang = langSel.value || "node";
        var desc = (descInp.value || "").trim() || "Safe network and endpoint diagnostics";
        return {
          name: rawName,
          language: lang,
          category: "diagnostics",
          inputs: ["target"],
          operations: selectedOps(),
          description: desc,
          constraints: {
            sandboxOnly: true,
            allowlistOps: ["dns_a", "dns_aaaa", "dns_mx", "tcp_ports", "http_probe", "json_report"],
            timeoutMs: 4000
          },
          output: { format: "json" }
        };
      }

      function generateRealCode(spec) {
        var safeSlug = spec.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "diagnostic-tool";
        var opsList = spec.operations;

        if (spec.language === "python") {
          currentFile = safeSlug + ".py";
          var pyLines = [
            "#!/usr/bin/env python3",
            "import argparse",
            "import datetime",
            "import json",
            "import socket",
            "",
            "def run_diagnostics(target: str) -> dict:",
            "    report = {",
            "        'tool': " + JSON.stringify(spec.name) + ",",
            "        'target': target,",
            "        'timestamp': datetime.datetime.utcnow().isoformat() + 'Z',",
            "        'operations': " + JSON.stringify(opsList) + ",",
            "        'results': {}",
            "    }"
          ];
          if (opsList.indexOf("dns_a") !== -1) {
            pyLines.push("    try:");
            pyLines.push("        infos = socket.getaddrinfo(target, None, socket.AF_INET)");
            pyLines.push("        report['results']['A'] = sorted(list({x[4][0] for x in infos}))");
            pyLines.push("    except Exception as exc:");
            pyLines.push("        report['results']['A_error'] = str(exc)");
          }
          if (opsList.indexOf("dns_aaaa") !== -1) {
            pyLines.push("    try:");
            pyLines.push("        infos6 = socket.getaddrinfo(target, None, socket.AF_INET6)");
            pyLines.push("        report['results']['AAAA'] = sorted(list({x[4][0] for x in infos6}))");
            pyLines.push("    except Exception as exc:");
            pyLines.push("        report['results']['AAAA_error'] = str(exc)");
          }
          if (opsList.indexOf("tcp_ports") !== -1) {
            pyLines.push("    ports_status = {}");
            pyLines.push("    for p in (80, 443):");
            pyLines.push("        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)");
            pyLines.push("        s.settimeout(2.0)");
            pyLines.push("        try:");
            pyLines.push("            ports_status[str(p)] = (s.connect_ex((target, p)) == 0)");
            pyLines.push("        finally:");
            pyLines.push("            s.close()");
            pyLines.push("    report['results']['tcp_ports'] = ports_status");
          }
          pyLines.push("    return report");
          pyLines.push("");
          pyLines.push("if __name__ == '__main__':");
          pyLines.push("    parser = argparse.ArgumentParser(description=" + JSON.stringify(spec.name) + ")");
          pyLines.push("    parser.add_argument('--target', default='example.com')");
          pyLines.push("    args = parser.parse_args()");
          pyLines.push("    print(json.dumps(run_diagnostics(args.target), indent=2))");
          return pyLines.join("\n");
        }

        if (spec.language === "bash") {
          currentFile = safeSlug + ".sh";
          var shLines = [
            "#!/usr/bin/env bash",
            "set -euo pipefail",
            "TARGET=\"${1:-example.com}\"",
            "printf '{\\n  \"tool\": %s,\\n  \"target\": \"%s\",\\n  \"timestamp\": \"%s\"' " + JSON.stringify(spec.name) + " \"$TARGET\" \"$(date -Iseconds)\""
          ];
          if (opsList.indexOf("dns_a") !== -1) {
            shLines.push("if command -v getent >/dev/null 2>&1; then");
            shLines.push("  A_VALS=$(getent ahostsv4 \"$TARGET\" | awk '{print $1}' | sort -u | paste -sd ',' - || true)");
            shLines.push("  printf ',\\n  \"A\": [%s]' \"$(printf '\"%s\"' ${A_VALS//,/ } 2>/dev/null || true)\"");
            shLines.push("fi");
          }
          if (opsList.indexOf("tcp_ports") !== -1) {
            shLines.push("for P in 80 443; do");
            shLines.push("  if timeout 2 bash -c \"</dev/tcp/$TARGET/$P\" 2>/dev/null; then");
            shLines.push("    printf ',\\n  \"tcp_%s\": \"open\"' \"$P\"");
            shLines.push("  else");
            shLines.push("    printf ',\\n  \"tcp_%s\": \"closed/filtered\"' \"$P\"");
            shLines.push("  fi");
            shLines.push("done");
          }
          shLines.push("printf '\\n}\\n'");
          return shLines.join("\n");
        }

        currentFile = safeSlug + ".js";
        var jsLines = [
          "\"use strict\";",
          "const dns = require(\"dns\").promises;",
          "const net = require(\"net\");",
          "",
          "function checkTcpPort(host, port, timeoutMs = 2000) {",
          "  return new Promise((resolve) => {",
          "    const sock = new net.Socket();",
          "    const done = (open) => { sock.destroy(); resolve({ port, open }); };",
          "    sock.setTimeout(timeoutMs);",
          "    sock.once(\"connect\", () => done(true));",
          "    sock.once(\"timeout\", () => done(false));",
          "    sock.once(\"error\", () => done(false));",
          "    sock.connect(port, host);",
          "  });",
          "}",
          "",
          "async function executeTool(context = {}) {",
          "  const target = String(context.target || \"example.com\").trim();",
          "  const out = {",
          "    tool: " + JSON.stringify(spec.name) + ",",
          "    target,",
          "    timestamp: new Date().toISOString(),",
          "    operations: " + JSON.stringify(opsList) + ",",
          "    data: {}",
          "  };"
        ];

        if (opsList.indexOf("dns_a") !== -1) {
          jsLines.push("  try { out.data.A = await dns.resolve4(target); } catch (e) { out.data.A_error = e.code || e.message; }");
        }
        if (opsList.indexOf("dns_aaaa") !== -1) {
          jsLines.push("  try { out.data.AAAA = await dns.resolve6(target); } catch (e) { out.data.AAAA_error = e.code || e.message; }");
        }
        if (opsList.indexOf("dns_mx") !== -1) {
          jsLines.push("  try { out.data.MX = await dns.resolveMx(target); } catch (e) { out.data.MX_error = e.code || e.message; }");
        }
        if (opsList.indexOf("tcp_ports") !== -1) {
          jsLines.push("  out.data.tcp = await Promise.all([checkTcpPort(target, 80), checkTcpPort(target, 443)]);");
        }
        if (opsList.indexOf("http_probe") !== -1 && typeof fetch === "function") {
          jsLines.push("  try {");
          jsLines.push("    const res = await fetch(\"https://\" + target, { method: \"HEAD\" });");
          jsLines.push("    out.data.http = { ok: res.ok, status: res.status, server: res.headers.get(\"server\") || null };");
          jsLines.push("  } catch (e) { out.data.http_error = e.message; }");
        }

        jsLines.push("  return out;");
        jsLines.push("}");
        jsLines.push("");
        jsLines.push("if (require.main === module) {");
        jsLines.push("  const argTarget = process.argv[2] || \"example.com\";");
        jsLines.push("  executeTool({ target: argTarget }).then((r) => console.log(JSON.stringify(r, null, 2)));");
        jsLines.push("}");
        jsLines.push("");
        jsLines.push("module.exports = { execute: executeTool };");
        return jsLines.join("\n");
      }

      function validateCurrent() {
        var combined = (specInputText()) + "\n" + currentCode;
        var issues = [];
        FORBIDDEN_PATTERNS.forEach(function(rx){
          if (rx.test(combined)) issues.push("Блокиран опасен патерн: " + rx.toString());
        });
        if (!currentCode.trim()) issues.push("Липсва генериран код.");
        if (!currentSpec || !Array.isArray(currentSpec.operations) || currentSpec.operations.length === 0) {
          issues.push("Липсват валидни операции в спецификацията.");
        }

        if (issues.length) {
          valBanner.innerHTML = 'Статус на валидатора: <strong class="status-err">ОТХВЪРЛЕНО (' + issues.join("; ") + ')</strong>';
          return false;
        }
        valBanner.innerHTML = 'Статус на валидатора: <strong class="status-ok">ВАЛИДНО (Allowlist OK • Без опасни команди • Готово за тест/експорт)</strong>';
        return true;
      }

      function specInputText() {
        return (nameInp.value || "") + "\n" + (descInp.value || "") + "\n" + (targetInp.value || "");
      }

      function loadSaved() {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch (_) { return []; }
      }

      function saveList(arr) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); } catch (_) {}
        renderSaved();
      }

      function renderSaved() {
        var arr = loadSaved();
        if (!arr.length) {
          savedList.innerHTML = '<div style="color:#a1a1aa;font-size:12px;">Няма запазени готови инструменти.</div>';
          return;
        }
        savedList.innerHTML = "";
        arr.forEach(function(item, idx){
          var div = document.createElement("div");
          div.className = "tool-item";
          div.innerHTML = '<div><strong style="color:#fbbf24;">' + esc(item.name) + '</strong> <span style="color:#38bdf8;font-size:11px;">[' + esc(item.language) + ' • ' + esc(item.fileName) + ']</span></div>';
          var bLoad = document.createElement("button");
          bLoad.type = "button";
          bLoad.textContent = "Зареди";
          bLoad.style.marginTop = "6px";
          bLoad.onclick = function(){
            currentSpec = item.spec;
            currentCode = item.code;
            currentFile = item.fileName;
            codeOut.textContent = currentCode;
            testOut.textContent = JSON.stringify({ spec: currentSpec, lastTestOutput: item.lastTestOutput || null }, null, 2);
            validateCurrent();
          };
          var bDel = document.createElement("button");
          bDel.type = "button";
          bDel.className = "warn";
          bDel.textContent = "Изтрий";
          bDel.style.marginLeft = "6px";
          bDel.onclick = function(){
            saveList(loadSaved().filter(function(_, i){ return i !== idx; }));
          };
          div.appendChild(bLoad);
          div.appendChild(bDel);
          savedList.appendChild(div);
        });
      }

      function esc(s) {
        return String(s || "").replace(/[&<>"']/g, function(m){
          return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[m];
        });
      }

      genBtn.addEventListener("click", function(){
        currentSpec = buildSpec();
        currentCode = generateRealCode(currentSpec);
        codeOut.textContent = currentCode;
        validateCurrent();
        testOut.textContent = JSON.stringify({ step: "generated", spec: currentSpec }, null, 2);

        var arr = loadSaved();
        arr.unshift({
          name: currentSpec.name,
          language: currentSpec.language,
          fileName: currentFile,
          spec: currentSpec,
          code: currentCode,
          savedAt: new Date().toISOString()
        });
        saveList(arr.slice(0, 50));
      });

      valBtn.addEventListener("click", function(){
        if (!currentSpec) currentSpec = buildSpec();
        if (!currentCode) currentCode = generateRealCode(currentSpec);
        validateCurrent();
      });

      runBtn.addEventListener("click", function(){
        if (!currentSpec) currentSpec = buildSpec();
        if (!currentCode) currentCode = generateRealCode(currentSpec);
        if (!validateCurrent()) return;

        var target = (targetInp.value || "example.com").trim();
        var simOutput = {
          sandboxMode: "SAFE_DIAGNOSTIC_SIMULATION",
          target: target,
          executedAt: new Date().toISOString(),
          operationsChecked: currentSpec.operations,
          previewResult: {
            dns_a: currentSpec.operations.indexOf("dns_a") !== -1 ? ["93.184.216.34"] : undefined,
            dns_aaaa: currentSpec.operations.indexOf("dns_aaaa") !== -1 ? ["2606:2800:220:1:248:1893:25c8:1946"] : undefined,
            dns_mx: currentSpec.operations.indexOf("dns_mx") !== -1 ? [{ priority: 10, exchange: "mail." + target }] : undefined,
            tcp_ports: currentSpec.operations.indexOf("tcp_ports") !== -1 ? [{ port: 80, open: true }, { port: 443, open: true }] : undefined
          },
          note: "За пълна мрежова проверка от терминал стартирай сваления файл директно в Node/Python/Bash."
        };
        testOut.textContent = JSON.stringify(simOutput, null, 2);
      });

      dlBtn.addEventListener("click", function(){
        if (!currentCode) {
          currentSpec = buildSpec();
          currentCode = generateRealCode(currentSpec);
          codeOut.textContent = currentCode;
        }
        var blob = new Blob([currentCode], { type: "text/plain;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = currentFile;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
      });

      copyBtn.addEventListener("click", function(){
        var txt = currentCode || codeOut.textContent || "";
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).catch(function(){});
        }
      });

      clrBtn.addEventListener("click", function(){
        saveList([]);
      });

      renderSaved();
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

fs.writeFileSync(path.join(pubDir, "devanport-studio.html"), devHtml, "utf8");
console.log("DEVANPORT_READY_STUDIO_BUILT -> public/devanport-studio.html");
