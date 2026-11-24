const fs = require("fs");
const path = require("path");

const consolePath = path.join(__dirname, "..", "public", "marauder-live-console.js");
if (!fs.existsSync(consolePath)) {
  console.error("Missing public/marauder-live-console.js");
  process.exit(1);
}

let code = fs.readFileSync(consolePath, "utf8");

const armorySnippet = `
    // MARAUDER AI ARMY – FULL EQUIPMENT SYSTEM панел
    if (!document.getElementById("mrd-agent-armory-panel")) {
      const armBox = document.createElement("section");
      armBox.id = "mrd-agent-armory-panel";
      armBox.className = "mrd-box";
      armBox.innerHTML = \`
        <div class="mrd-box-title">
          <span>MARAUDER AGENT ARMORY // 20 ARMED AGENTS + 80 TOOLS</span>
          <span id="mrd-armory-badge" style="color:#4ade80">READ-ONLY DEFAULT</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <input id="mrd-armory-search" class="mrd-search" style="flex:1;min-width:180px" type="text" placeholder="Търси агент, инструмент (Wazuh, YARA, Zeek, Ghidra) или среда (kali, termux)..." />
          <select id="mrd-armory-env" class="mrd-search" style="width:auto">
            <option value="kali">Kali Linux</option>
            <option value="ubuntu-wsl">Ubuntu WSL</option>
            <option value="windows-powershell">Windows PowerShell</option>
            <option value="termux">Termux</option>
          </select>
        </div>
        <div id="mrd-armory-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:6px;max-height:260px;overflow-y:auto"></div>
      \`;
      app.insertBefore(armBox, document.getElementById("mrd-bottom-bar") || null);

      let armedAgents = [];

      function renderArmory() {
        const q = (document.getElementById("mrd-armory-search").value || "").trim().toLowerCase();
        const env = document.getElementById("mrd-armory-env").value;
        const grid = document.getElementById("mrd-armory-grid");
        if (!grid) return;

        const list = armedAgents.filter((a) => {
          if (!q) return true;
          const hay = (a.name + " " + a.specialization + " " + (a.tools || []).join(" ") + " " + (a.bridges || []).join(" ")).toLowerCase();
          return hay.includes(q);
        });

        grid.innerHTML = list.map((a) => \`
          <div style="border:1px solid #2b1016;border-radius:7px;padding:8px;background:#0c101a;display:flex;flex-direction:column;gap:4px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:4px">
              <strong style="font-size:11px;color:#fff">#\${a.id} \${a.name}</strong>
              <span style="font-size:9px;padding:2px 5px;border-radius:4px;background:#171118;color:#fca5a5">\${a.permissions || "read-only"}</span>
            </div>
            <div style="font-size:10px;color:#93c5fd">Инструменти: \${(a.tools || []).join(", ")}</div>
            <div style="font-size:11px;color:#cbd5e1">\${a.specialization}</div>
            <div style="font-size:10px;color:#9ca3af">Среди: \${(a.bridges || []).join(", ")}</div>
            <button class="mrd-btn" style="padding:5px 8px;font-size:10px;margin-top:2px" data-arm-slug="\${a.slug}">ВЪОРЪЖИ И ИЗПРАТИ (\${env})</button>
          </div>
        \`).join("");

        grid.querySelectorAll("[data-arm-slug]").forEach((btn) => {
          btn.onclick = () => {
            const slug = btn.dataset.armSlug;
            const agent = armedAgents.find((x) => x.slug === slug);
            if (!agent) return;
            const titleEl = document.getElementById("mrd-center-title");
            if (titleEl) titleEl.textContent = agent.name + " // " + env.toUpperCase() + " [READ-ONLY]";
            if (typeof appendMsg === "function") {
              appendMsg(
                "ai",
                "AGENT ARMORY",
                "Агент <strong>" + agent.name + "</strong> (модел: " + agent.model + ", инструменти: <strong>" + (agent.tools || []).join(", ") + "</strong>) е насочен към <strong>" + env + "</strong> с <strong>read-only</strong> права по подразбиране."
              );
            }
          };
        });
      }

      document.getElementById("mrd-armory-search").addEventListener("input", renderArmory);
      document.getElementById("mrd-armory-env").addEventListener("change", renderArmory);

      fetch("/data/agent-registry.json", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d || !Array.isArray(d.agents)) return;
          armedAgents = d.agents;
          renderArmory();
        })
        .catch(() => {});
    }
`;

if (!code.includes("mrd-agent-armory-panel")) {
  code = code.replace(
    /document\.body\.appendChild\(app\);/,
    "document.body.appendChild(app);\n" + armorySnippet.trim()
  );
  fs.writeFileSync(consolePath, code, "utf8");
}

console.log("Agent Armory panel integrated.");
