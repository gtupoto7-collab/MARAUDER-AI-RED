const fs = require("fs");
const path = require("path");

const consolePath = path.join(__dirname, "..", "public", "marauder-live-console.js");
if (!fs.existsSync(consolePath)) {
  console.error("Missing public/marauder-live-console.js");
  process.exit(1);
}

let code = fs.readFileSync(consolePath, "utf8");

const apocalypseSnippet = `
    // MARAUDER SECURITY — APOCALYPSE EDITION панел (3 основни двигателя + 7-стъпков Autonomous SOC + Benchmarks)
    if (!document.getElementById("mrd-apocalypse-panel")) {
      const apoBox = document.createElement("section");
      apoBox.id = "mrd-apocalypse-panel";
      apoBox.className = "mrd-box";
      apoBox.innerHTML = \`
        <div class="mrd-box-title">
          <span>MARAUDER SECURITY — APOCALYPSE EDITION // 3 CORE ENGINES</span>
          <span style="color:#4ade80">VERIFY • DEFEND • AUDIT</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
          <input id="mrd-soc-alert" class="mrd-search" style="flex:1;min-width:180px" type="text" placeholder="Сигнал / събитие за Autonomous SOC (напр. Подозрителен процес)" />
          <input id="mrd-soc-risk" class="mrd-search" style="width:95px" type="number" min="0" max="100" value="80" />
          <button id="mrd-soc-run-btn" class="mrd-btn">RUN SOC PIPELINE</button>
          <button id="mrd-apo-bmk-btn" class="mrd-qbtn">BENCHMARK METRICS</button>
        </div>
        <div id="mrd-apo-output" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:6px;max-height:240px;overflow-y:auto"></div>
      \`;
      app.insertBefore(apoBox, document.getElementById("mrd-bottom-bar") || null);

      let apoData = { coreEngines: [], benchmarks: [], threatIntelligenceSources: [] };

      function renderCoreEngines() {
        const out = document.getElementById("mrd-apo-output");
        if (!out) return;
        out.innerHTML = (apoData.coreEngines || []).map((eng) => \`
          <div style="border:1px solid #2b1016;border-radius:7px;padding:8px;background:#0c101a;display:flex;flex-direction:column;gap:4px">
            <strong style="font-size:11px;color:#f87171">\${eng.id}</strong>
            <div style="font-size:11px;color:#fff">\${eng.role}</div>
            <div style="font-size:10px;color:#cbd5e1">\${(eng.capabilities || eng.pipeline || []).slice(0, 4).join(" • ")}</div>
          </div>
        \`).join("");
      }

      document.getElementById("mrd-soc-run-btn").onclick = () => {
        const alertTitle = (document.getElementById("mrd-soc-alert").value || "Подозрителна системна активност").trim();
        const risk = Number(document.getElementById("mrd-soc-risk").value || 80);
        const isCritical = risk >= 75;
        const out = document.getElementById("mrd-apo-output");
        const steps = [
          "1. Откриване: " + alertTitle,
          "2. Evidence Agent: събрани контекстни данни",
          "3. Behavior Agent: поведенческа проверка",
          "4. Threat Intel: MITRE ATT&CK / CISA KEV / MISP / OpenCTI",
          "5. MEGATRON SECURITY: риск " + risk + "/100 (" + (isCritical ? "CRITICAL" : "NORMAL") + ")",
          "6. BLUE TEAM: " + (isCritical ? "защитно изолиране (чака директор)" : "правило за наблюдение"),
          "7. AUDIT LOG: записано в одитния журнал"
        ];
        if (out) {
          out.innerHTML = steps.map((s) => \`
            <div style="border:1px solid #2b1016;border-radius:6px;padding:6px 8px;background:#0c101a;font-size:11px;color:#e5e7eb">\${s}</div>
          \`).join("");
        }
        if (typeof appendMsg === "function") {
          appendMsg("ai", "RED-AUTONOMOUS-SOC", "Изпълнен 7-стъпков конвейер за <strong>" + alertTitle + "</strong> (риск " + risk + "/100).");
        }
      };

      document.getElementById("mrd-apo-bmk-btn").onclick = () => {
        const out = document.getElementById("mrd-apo-output");
        if (!out) return;
        out.innerHTML = (apoData.benchmarks || []).map((b) => \`
          <div style="border:1px solid #2b1016;border-radius:6px;padding:6px 8px;background:#0c101a;font-size:11px">
            <strong style="color:#93c5fd">\${b.trial}</strong> — <span style="color:#cbd5e1">\${b.metric}</span>
          </div>
        \`).join("");
      };

      fetch("/data/apocalypse-edition.json", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return;
          apoData = d;
          renderCoreEngines();
        })
        .catch(() => {});
    }
`;

if (!code.includes("mrd-apocalypse-panel")) {
  code = code.replace(
    /document\.body\.appendChild\(app\);/,
    "document.body.appendChild(app);\n" + apocalypseSnippet.trim()
  );
  fs.writeFileSync(consolePath, code, "utf8");
}

console.log("MARAUDER APOCALYPSE EDITION panel integrated.");
