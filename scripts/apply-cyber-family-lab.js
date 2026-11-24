const fs = require("fs");
const path = require("path");

const consolePath = path.join(__dirname, "..", "public", "marauder-live-console.js");
if (!fs.existsSync(consolePath)) {
  console.error("Missing public/marauder-live-console.js");
  process.exit(1);
}

let code = fs.readFileSync(consolePath, "utf8");

const familyLabSnippet = `
    // MARAUDER — AI CYBER FAMILY & 6-STAGE PIPELINE (RECON -> ANALYSIS -> DETECTION -> VALIDATION -> DEFENSE -> REPORT)
    if (!document.getElementById("mrd-cyber-family-lab-panel")) {
      const famPanel = document.createElement("section");
      famPanel.id = "mrd-cyber-family-lab-panel";
      famPanel.className = "mrd-box";
      famPanel.innerHTML = \`
        <div class="mrd-box-title">
          <span>MARAUDER — AI CYBER FAMILY // LEGITIMATE LAB & PRIVATE RED LAB</span>
          <span style="color:#4ade80">NO UNLIMITED AGENT GRANTS</span>
        </div>
        <div style="font-size:11px;color:#cbd5e1">
          Конвейер: <strong style="color:#fca5a5">RECON → ANALYSIS → DETECTION → VALIDATION → DEFENSE → REPORT</strong> • Среди: Windows / Linux / Android / Cloud
        </div>
        <div id="mrd-pipeline-stages" style="display:flex;flex-wrap:wrap;gap:5px"></div>
        <div id="mrd-family-chain" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:6px;max-height:190px;overflow-y:auto"></div>
      \`;
      app.insertBefore(famPanel, document.getElementById("mrd-bottom-bar") || null);

      fetch("/data/cyber-family-lab.json", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return;
          const stagesEl = document.getElementById("mrd-pipeline-stages");
          const chainEl = document.getElementById("mrd-family-chain");
          if (stagesEl && Array.isArray(d.taskPipeline)) {
            stagesEl.innerHTML = d.taskPipeline.map((st, i) => \`
              <button class="mrd-qbtn" data-pipe-stage="\${st}">\${i + 1}. \${st}</button>
            \`).join("");
            stagesEl.querySelectorAll("[data-pipe-stage]").forEach((btn) => {
              btn.onclick = () => {
                const st = btn.dataset.pipeStage;
                if (typeof appendMsg === "function") {
                  appendMsg("ai", "CYBER LAB PIPELINE", "Етап <strong>" + st + "</strong> активен в контролирания поток (без самоволно даване на неограничени права).");
                }
              };
            });
          }
          if (chainEl && Array.isArray(d.familyHierarchy)) {
            chainEl.innerHTML = d.familyHierarchy.map((node) => \`
              <div style="border:1px solid #2b1016;border-radius:6px;padding:6px 8px;background:#0c101a;font-size:11px;color:#fff">\${node}</div>
            \`).join("");
          }
        })
        .catch(() => {});
    }
`;

if (!code.includes("mrd-cyber-family-lab-panel")) {
  code = code.replace(
    /document\.body\.appendChild\(app\);/,
    "document.body.appendChild(app);\n" + familyLabSnippet.trim()
  );
  fs.writeFileSync(consolePath, code, "utf8");
}

console.log("AI Cyber Family & Pipeline panel integrated.");
