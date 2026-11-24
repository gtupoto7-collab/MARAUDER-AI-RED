const fs = require("fs");
const path = require("path");

const consolePath = path.join(__dirname, "..", "public", "marauder-live-console.js");
if (!fs.existsSync(consolePath)) {
  console.error("Missing public/marauder-live-console.js");
  process.exit(1);
}

let code = fs.readFileSync(consolePath, "utf8");

const upgradeSnippet = `
    // MARAUDER CYBER DEFENSE ENGINE — 100 надграждащи функции (I-X + TOP 10 PRIORITY)
    if (!document.getElementById("mrd-defense-100-panel")) {
      const defBox = document.createElement("section");
      defBox.id = "mrd-defense-100-panel";
      defBox.className = "mrd-box";
      defBox.innerHTML = \`
        <div class="mrd-box-title">
          <span>MARAUDER CYBER DEFENSE ENGINE // 100 UPGRADES (I–X)</span>
          <span id="mrd-def-counter" style="color:#4ade80">100 FUNCS</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <input id="mrd-def-search" class="mrd-search" style="flex:1;min-width:180px" type="text" placeholder="Филтрирай 100-те функции (Malware, SOC, Network, Kali, Agent Guard)..." />
          <select id="mrd-def-section" class="mrd-search" style="width:auto">
            <option value="">Всички секции (I–X)</option>
            <option value="I. AI DEFENSE CORE">I. AI Defense Core</option>
            <option value="II. ADVANCED MALWARE INTELLIGENCE">II. Advanced Malware Intelligence</option>
            <option value="III. NETWORK CYBER DEFENSE">III. Network Cyber Defense</option>
            <option value="IV. VULNERABILITY INTELLIGENCE">IV. Vulnerability Intelligence</option>
            <option value="V. ENDPOINT & DEVICE DEFENSE">V. Endpoint & Device Defense</option>
            <option value="VI. THREAT INTELLIGENCE">VI. Threat Intelligence</option>
            <option value="VII. INCIDENT RESPONSE & FORENSICS">VII. Incident Response & Forensics</option>
            <option value="VIII. CLOUD, SERVER & INFRASTRUCTURE SECURITY">VIII. Cloud, Server & Infrastructure</option>
            <option value="IX. AI AGENT SECURITY">IX. AI Agent Security</option>
            <option value="X. ADVANCED CYBER LAB & AUTOMATION">X. Cyber Lab & Automation</option>
          </select>
          <button id="mrd-def-top10-btn" class="mrd-qbtn">FIRST 10 PRIORITY</button>
        </div>
        <div id="mrd-def-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:6px;max-height:250px;overflow-y:auto"></div>
      \`;
      app.insertBefore(defBox, document.getElementById("mrd-bottom-bar") || null);

      let allUpgrades = [];
      let top10Set = new Set();
      let onlyTop10 = false;

      function renderUpgradesGrid() {
        const q = (document.getElementById("mrd-def-search").value || "").trim().toLowerCase();
        const sec = document.getElementById("mrd-def-section").value;
        const grid = document.getElementById("mrd-def-grid");
        const counter = document.getElementById("mrd-def-counter");
        if (!grid) return;

        const filtered = allUpgrades.filter((u) => {
          if (sec && u.section !== sec) return false;
          if (onlyTop10 && !top10Set.has((u.name || "").toLowerCase())) return false;
          if (!q) return true;
          return (u.id + " " + u.name + " " + u.section + " " + u.purpose).toLowerCase().includes(q);
        });

        if (counter) counter.textContent = filtered.length + " / " + allUpgrades.length;
        grid.innerHTML = filtered.slice(0, 40).map((u) => \`
          <div style="border:1px solid #2b1016;border-radius:7px;padding:7px 8px;background:#0c101a;cursor:pointer" data-up-name="\${encodeURIComponent(u.name)}" data-up-sec="\${encodeURIComponent(u.section)}" data-up-purp="\${encodeURIComponent(u.purpose)}">
            <div style="display:flex;justify-content:space-between;gap:4px">
              <strong style="font-size:11px;color:#fff">#\${u.id} \${u.name}</strong>
              <span style="font-size:9px;color:#4ade80">\${top10Set.has((u.name || "").toLowerCase()) ? "TOP 10" : ""}</span>
            </div>
            <div style="font-size:10px;color:#fca5a5">\${u.section}</div>
            <div style="font-size:11px;color:#cbd5e1;margin-top:2px">\${u.purpose}</div>
          </div>
        \`).join("");

        grid.querySelectorAll("[data-up-name]").forEach((card) => {
          card.onclick = () => {
            const name = decodeURIComponent(card.dataset.upName);
            const section = decodeURIComponent(card.dataset.upSec);
            const purpose = decodeURIComponent(card.dataset.upPurp);
            const titleEl = document.getElementById("mrd-center-title");
            if (titleEl) titleEl.textContent = "DEFENSE ENGINE // " + name.toUpperCase();
            if (typeof appendMsg === "function") {
              appendMsg("ai", "CYBER DEFENSE ENGINE", "Активирана функция <strong>" + name + "</strong> [" + section + "] — " + purpose);
            }
          };
        });
      }

      document.getElementById("mrd-def-search").addEventListener("input", renderUpgradesGrid);
      document.getElementById("mrd-def-section").addEventListener("change", renderUpgradesGrid);
      document.getElementById("mrd-def-top10-btn").addEventListener("click", (e) => {
        onlyTop10 = !onlyTop10;
        e.target.style.background = onlyTop10 ? "#991b1b" : "";
        renderUpgradesGrid();
      });

      fetch("/data/marauder-100-upgrades.json", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return;
          allUpgrades = d.upgrades || [];
          top10Set = new Set((d.priorityTop10 || []).map((x) => (x || "").toLowerCase()));
          renderUpgradesGrid();
        })
        .catch(() => {});
    }
`;

if (!code.includes("mrd-defense-100-panel")) {
  code = code.replace(
    /document\.body\.appendChild\(app\);/,
    "document.body.appendChild(app);\n" + upgradeSnippet.trim()
  );
  fs.writeFileSync(consolePath, code, "utf8");
}

console.log("Applied 100 Cyber Defense upgrades panel.");
