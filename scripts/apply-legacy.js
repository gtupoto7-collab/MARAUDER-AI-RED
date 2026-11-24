const fs = require("fs");
const path = require("path");

const consolePath = path.join(__dirname, "..", "public", "marauder-live-console.js");
if (!fs.existsSync(consolePath)) {
  console.error("Missing public/marauder-live-console.js");
  process.exit(1);
}

let code = fs.readFileSync(consolePath, "utf8");

const legacySnippet = `
    // RED SOFTWARE TEAM — LEGACY ARCHITECTURE (FOUNDED 2026)
    if (!document.getElementById("mrd-legacy-panel")) {
      const legBox = document.createElement("section");
      legBox.id = "mrd-legacy-panel";
      legBox.className = "mrd-box";
      legBox.innerHTML = \`
        <div class="mrd-box-title">
          <span>RED SOFTWARE TEAM — LEGACY ARCHITECTURE // FOUNDED 2026</span>
          <span style="color:#4ade80">MODEL-AGNOSTIC CORE</span>
        </div>
        <div style="font-size:11px;color:#fca5a5;font-weight:700">
          MARAUDER SHOULDN'T NEED US FOREVER. • OPEN / DOCUMENTED APIs -> FUTURE AI SYSTEMS
        </div>
        <div id="mrd-legacy-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:6px;max-height:220px;overflow-y:auto"></div>
      \`;
      app.insertBefore(legBox, document.getElementById("mrd-bottom-bar") || null);

      fetch("/data/legacy-architecture.json", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d || !Array.isArray(d.continuityPillars)) return;
          const grid = document.getElementById("mrd-legacy-grid");
          if (!grid) return;
          grid.innerHTML = d.continuityPillars.map((p) => \`
            <div style="border:1px solid #2b1016;border-radius:7px;padding:7px 8px;background:#0c101a;cursor:pointer" data-leg-title="\${encodeURIComponent(p.title)}" data-leg-st="\${encodeURIComponent(p.status)}">
              <div style="display:flex;justify-content:space-between;gap:4px">
                <strong style="font-size:11px;color:#fff">\${p.id}</strong>
                <span style="font-size:9px;color:#93c5fd">\${p.status}</span>
              </div>
              <div style="font-size:11px;color:#cbd5e1;margin-top:3px">\${p.title}</div>
            </div>
          \`).join("");

          grid.querySelectorAll("[data-leg-title]").forEach((el) => {
            el.onclick = () => {
              const title = decodeURIComponent(el.dataset.legTitle);
              const st = decodeURIComponent(el.dataset.legSt);
              if (typeof appendMsg === "function") {
                appendMsg("ai", "LEGACY ARCHIVE", "Стълб <strong>" + title + "</strong> [" + st + "] — част от приемствеността на RED SOFTWARE TEAM (FOUNDED 2026).");
              }
            };
          });
        })
        .catch(() => {});
    }
`;

if (!code.includes("mrd-legacy-panel")) {
  code = code.replace(
    /document\.body\.appendChild\(app\);/,
    "document.body.appendChild(app);\n" + legacySnippet.trim()
  );
  fs.writeFileSync(consolePath, code, "utf8");
}

console.log("Legacy architecture panel integrated.");
