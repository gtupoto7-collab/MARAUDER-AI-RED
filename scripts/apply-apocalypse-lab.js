const fs = require("fs");
const path = require("path");

const consolePath = path.join(__dirname, "..", "public", "marauder-live-console.js");
if (!fs.existsSync(consolePath)) {
  console.error("Missing public/marauder-live-console.js");
  process.exit(1);
}

let code = fs.readFileSync(consolePath, "utf8");

const labSnippet = `
    // APOCALYPSE LAB — 5 подразделения (HACKING LAB, MALWARE LAB, REVERSE ENGINEERING, RED/BLUE TEAM, AUTONOMOUS CYBER AI)
    if (!document.getElementById("mrd-apocalypse-lab-panel")) {
      const labPanel = document.createElement("section");
      labPanel.id = "mrd-apocalypse-lab-panel";
      labPanel.className = "mrd-box";
      labPanel.innerHTML = \`
        <div class="mrd-box-title">
          <span>APOCALYPSE LAB // 5 DIVISIONS • AUTHORIZED SCOPE ONLY</span>
          <span id="mrd-lab-count" style="color:#4ade80">LAB READY</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
          <select id="mrd-lab-div" class="mrd-search" style="width:auto">
            <option value="ALL">Всички подразделения (5)</option>
            <option value="HACKING LAB">HACKING LAB</option>
            <option value="MALWARE LAB">MALWARE LAB</option>
            <option value="REVERSE ENGINEERING">REVERSE ENGINEERING</option>
            <option value="RED TEAM / BLUE TEAM">RED TEAM / BLUE TEAM</option>
            <option value="AUTONOMOUS CYBER AI">AUTONOMOUS CYBER AI</option>
          </select>
          <input id="mrd-lab-search" class="mrd-search" style="flex:1;min-width:170px" type="text" placeholder="Търси модул, инструмент (Nmap, Ghidra, YARA-X, Volatility 3) или агент..." />
        </div>
        <div id="mrd-lab-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:6px;max-height:250px;overflow-y:auto"></div>
      \`;
      app.insertBefore(labPanel, document.getElementById("mrd-bottom-bar") || null);

      let labBundle = [];

      function renderApocalypseLab() {
        const divSel = document.getElementById("mrd-lab-div").value;
        const q = (document.getElementById("mrd-lab-search").value || "").trim().toLowerCase();
        const grid = document.getElementById("mrd-lab-grid");
        const countEl = document.getElementById("mrd-lab-count");
        if (!grid) return;

        const filtered = labBundle.filter((item) => {
          if (divSel !== "ALL" && item.division !== divSel) return false;
          if (!q) return true;
          return (item.title + " " + item.division + " " + item.detail).toLowerCase().includes(q);
        });

        if (countEl) countEl.textContent = filtered.length + " ITEMS";
        grid.innerHTML = filtered.slice(0, 40).map((it) => \`
          <div style="border:1px solid #2b1016;border-radius:7px;padding:7px 8px;background:#0c101a;cursor:pointer" data-lab-title="\${encodeURIComponent(it.title)}" data-lab-div="\${encodeURIComponent(it.division)}" data-lab-det="\${encodeURIComponent(it.detail)}">
            <div style="display:flex;justify-content:space-between;gap:4px">
              <strong style="font-size:11px;color:#fff">\${it.title}</strong>
              <span style="font-size:9px;color:#fca5a5">\${it.division}</span>
            </div>
            <div style="font-size:10px;color:#cbd5e1;margin-top:3px">\${it.detail}</div>
          </div>
        \`).join("");

        grid.querySelectorAll("[data-lab-title]").forEach((card) => {
          card.onclick = () => {
            const t = decodeURIComponent(card.dataset.labTitle);
            const dv = decodeURIComponent(card.dataset.labDiv);
            const dt = decodeURIComponent(card.dataset.labDet);
            const titleEl = document.getElementById("mrd-center-title");
            if (titleEl) titleEl.textContent = "APOCALYPSE LAB [" + dv + "] // " + t.toUpperCase();
            if (typeof appendMsg === "function") {
              appendMsg("ai", "APOCALYPSE LAB", "Избран модул <strong>" + t + "</strong> в <strong>" + dv + "</strong> — " + dt + " (само за разрешени цели).");
            }
          };
        });
      }

      document.getElementById("mrd-lab-div").addEventListener("change", renderApocalypseLab);
      document.getElementById("mrd-lab-search").addEventListener("input", renderApocalypseLab);

      fetch("/data/apocalypse-cyber-engine.json", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return;
          const rows = [];
          (d.hackingDivision || []).forEach((m) => rows.push({ division: "HACKING LAB", title: m.module, detail: "Инструменти: " + (m.tools || []).join(", ") }));
          (d.malwareApocalypse || []).forEach((m) => rows.push({ division: m.division || "MALWARE LAB", title: m.module, detail: "Инструменти: " + (m.tools || []).join(", ") }));
          (d.malwareSpecialists || []).forEach((sp) => rows.push({ division: "MALWARE LAB", title: sp, detail: "Специализиран анализ и класификация на заплахи" }));
          (d.redBluePurple?.redTeam || []).forEach((x) => rows.push({ division: "RED TEAM / BLUE TEAM", title: "RED TEAM: " + x, detail: "Разрешена проверка и емулация в лаборатория" }));
          (d.redBluePurple?.blueTeam || []).forEach((x) => rows.push({ division: "RED TEAM / BLUE TEAM", title: "BLUE TEAM: " + x, detail: "Защита, детекция и реакция" }));
          (d.redBluePurple?.purpleTeam || []).forEach((x) => rows.push({ division: "RED TEAM / BLUE TEAM", title: "PURPLE TEAM", detail: x }));
          (d.autonomousCyberAgents || []).forEach((ag) => rows.push({ division: "AUTONOMOUS CYBER AI", title: ag.name, detail: "Мисия: " + ag.mission }));
          labBundle = rows;
          renderApocalypseLab();
        })
        .catch(() => {});
    }
`;

if (!code.includes("mrd-apocalypse-lab-panel")) {
  code = code.replace(
    /document\.body\.appendChild\(app\);/,
    "document.body.appendChild(app);\n" + labSnippet.trim()
  );
  fs.writeFileSync(consolePath, code, "utf8");
}

console.log("APOCALYPSE LAB panel integrated.");
