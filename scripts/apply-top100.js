const fs = require("fs");
const path = require("path");

const consolePath = path.join(__dirname, "..", "public", "marauder-live-console.js");
if (!fs.existsSync(consolePath)) {
  console.error("Missing public/marauder-live-console.js");
  process.exit(1);
}

let code = fs.readFileSync(consolePath, "utf8");

const panelSnippet = `
    // TOP 100 AI CYBERSECURITY AGENTS панел
    if (!document.getElementById("mrd-top100-section")) {
      const agentsSection = document.createElement("section");
      agentsSection.id = "mrd-top100-section";
      agentsSection.className = "mrd-box";
      agentsSection.innerHTML = \`
        <div class="mrd-box-title">
          <span>TOP 100 AI CYBERSECURITY AGENTS // MARAUDER ORCHESTRATOR</span>
          <span id="mrd-agents-counter" style="color:#4ade80">100 AGENTS</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <input id="mrd-agents-filter" class="mrd-search" style="flex:1;min-width:180px" type="text" placeholder="Филтрирай 100-те агента (SOC, Pentest, Malware, AI)..." />
          <select id="mrd-agents-section" class="mrd-search" style="width:auto">
            <option value="">Всички секции (I-IV)</option>
            <option value="I. AI SOC">I. AI SOC</option>
            <option value="II. AI Pentesting">II. AI Pentesting</option>
            <option value="III. AI Application & Cloud Security">III. AI App & Cloud Security</option>
            <option value="IV. AI Agent Security">IV. AI Agent Security</option>
          </select>
          <button id="mrd-agents-fav-btn" class="mrd-qbtn">TOP 15 FAVORITES</button>
        </div>
        <div id="mrd-agents-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:6px;max-height:240px;overflow-y:auto"></div>
      \`;
      app.insertBefore(agentsSection, document.getElementById("mrd-bottom-bar") || null);

      let allAgents = [];
      let favSet = new Set();
      let onlyFavs = false;

      function renderAgentsGrid() {
        const q = (document.getElementById("mrd-agents-filter").value || "").trim().toLowerCase();
        const sec = document.getElementById("mrd-agents-section").value;
        const grid = document.getElementById("mrd-agents-grid");
        const counter = document.getElementById("mrd-agents-counter");
        if (!grid) return;

        const filtered = allAgents.filter((a) => {
          if (sec && a.section !== sec) return false;
          if (onlyFavs && !favSet.has((a.name || "").toLowerCase())) return false;
          if (!q) return true;
          return (a.id + " " + a.name + " " + a.section + " " + a.summary).toLowerCase().includes(q);
        });

        if (counter) counter.textContent = filtered.length + " / " + allAgents.length;
        grid.innerHTML = filtered.slice(0, 36).map((a) => \`
          <div style="border:1px solid #2b1016;border-radius:7px;padding:7px 8px;background:#0c101a;cursor:pointer" data-agent-name="\${encodeURIComponent(a.name)}" data-agent-sec="\${encodeURIComponent(a.section)}" data-agent-sum="\${encodeURIComponent(a.summary)}">
            <div style="display:flex;justify-content:space-between;gap:4px">
              <strong style="font-size:11px;color:#fff">#\${a.id} \${a.name}</strong>
              <span style="font-size:9px;color:#fca5a5">\${favSet.has((a.name || "").toLowerCase()) ? "FAV" : ""}</span>
            </div>
            <div style="font-size:10px;color:#9ca3af">\${a.section}</div>
            <div style="font-size:11px;color:#cbd5e1;margin-top:2px">\${a.summary}</div>
          </div>
        \`).join("");

        grid.querySelectorAll("[data-agent-name]").forEach((card) => {
          card.onclick = () => {
            const name = decodeURIComponent(card.dataset.agentName);
            const section = decodeURIComponent(card.dataset.agentSec);
            const summary = decodeURIComponent(card.dataset.agentSum);
            const titleEl = document.getElementById("mrd-center-title");
            if (titleEl) titleEl.textContent = name.toUpperCase() + " // " + section;
            if (typeof appendMsg === "function") {
              appendMsg("ai", "ORCHESTRATOR", "Избран инструмент <strong>" + name + "</strong> (" + section + ") — " + summary);
            }
          };
        });
      }

      document.getElementById("mrd-agents-filter").addEventListener("input", renderAgentsGrid);
      document.getElementById("mrd-agents-section").addEventListener("change", renderAgentsGrid);
      document.getElementById("mrd-agents-fav-btn").addEventListener("click", (e) => {
        onlyFavs = !onlyFavs;
        e.target.style.background = onlyFavs ? "#991b1b" : "";
        renderAgentsGrid();
      });

      fetch("/data/top100-cyber-agents.json", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return;
          allAgents = d.agents || [];
          favSet = new Set((d.favorites15 || []).map((x) => (x.name || "").toLowerCase()));
          renderAgentsGrid();
        })
        .catch(() => {});
    }
`;

if (!code.includes("mrd-top100-section")) {
  code = code.replace(
    /document\.body\.appendChild\(app\);/,
    "document.body.appendChild(app);\n" + panelSnippet.trim()
  );
  fs.writeFileSync(consolePath, code, "utf8");
}

console.log("Applied Top 100 panel to marauder-live-console.js");
