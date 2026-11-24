const fs = require("fs");
const path = require("path");

const consolePath = path.join(__dirname, "..", "public", "marauder-live-console.js");
if (!fs.existsSync(consolePath)) {
  console.error("Missing public/marauder-live-console.js");
  process.exit(1);
}

let code = fs.readFileSync(consolePath, "utf8");

const godModeSnippet = `
    // MARAUDER GOD MODE CORE — War Room, Autonomous Army, Threat Radar & Security Factory
    if (!document.getElementById("mrd-god-mode-panel")) {
      const godBox = document.createElement("section");
      godBox.id = "mrd-god-mode-panel";
      godBox.className = "mrd-box";
      godBox.innerHTML = \`
        <div class="mrd-box-title">
          <span>MARAUDER GOD MODE // AUTONOMOUS CYBER DEFENSE ECOSYSTEM</span>
          <span style="color:#4ade80">NO FAKE AGENTS • READ-ONLY GUARD</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px">
          <div style="border:1px solid #2b1016;border-radius:8px;padding:8px;background:#0c101a;display:flex;flex-direction:column;gap:5px">
            <div style="font-size:11px;font-weight:900;color:#fca5a5">WAR ROOM & LOCAL HUB</div>
            <div style="font-size:11px;color:#cbd5e1">Среди: Kali Linux • Ubuntu • WSL • PowerShell • Termux • Docker</div>
            <div style="font-size:11px;color:#93c5fd">Радар: MITRE ATT&CK • CISA • OTX • AbuseIPDB • URLhaus • MalwareBazaar • OpenCTI</div>
            <div style="font-size:10px;color:#86efac">Zero-Trust • MFA • Immutable Audit Logs • Sandboxed Execution</div>
          </div>
          <div style="border:1px solid #2b1016;border-radius:8px;padding:8px;background:#0c101a;display:flex;flex-direction:column;gap:5px">
            <div style="font-size:11px;font-weight:900;color:#fca5a5">AI SECURITY FACTORY // CREATE AGENT</div>
            <input id="mrd-fac-name" class="mrd-search" type="text" placeholder="NAME (напр. PHANTOM-X)" />
            <input id="mrd-fac-spec" class="mrd-search" type="text" placeholder="SPECIALIZATION (напр. Network Security)" />
            <input id="mrd-fac-tools" class="mrd-search" type="text" placeholder="TOOLS (Zeek, Suricata, Wireshark)" />
            <button id="mrd-fac-btn" class="mrd-btn">GENERATE AGENT (READ-ONLY)</button>
          </div>
        </div>
        <div id="mrd-army-cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:6px;max-height:220px;overflow-y:auto"></div>
      \`;
      app.insertBefore(godBox, document.getElementById("mrd-bottom-bar") || null);

      const armyContainer = document.getElementById("mrd-army-cards");
      let armyList = [];

      function renderArmyCards() {
        if (!armyContainer) return;
        armyContainer.innerHTML = armyList.map((a) => \`
          <div style="border:1px solid #2b1016;border-radius:7px;padding:7px 8px;background:#0b0f18;cursor:pointer" data-eco-agent="\${encodeURIComponent(a.name)}" data-eco-spec="\${encodeURIComponent(a.specialization)}" data-eco-perm="\${encodeURIComponent(a.permissions || "read-only")}">
            <div style="display:flex;justify-content:space-between;gap:4px">
              <strong style="font-size:11px;color:#fff">\${a.name}</strong>
              <span style="font-size:9px;color:#fca5a5">\${a.permissions || "read-only"}</span>
            </div>
            <div style="font-size:11px;color:#cbd5e1;margin-top:2px">\${a.specialization}</div>
          </div>
        \`).join("");

        armyContainer.querySelectorAll("[data-eco-agent]").forEach((el) => {
          el.onclick = () => {
            const n = decodeURIComponent(el.dataset.ecoAgent);
            const s = decodeURIComponent(el.dataset.ecoSpec);
            const p = decodeURIComponent(el.dataset.ecoPerm);
            const titleEl = document.getElementById("mrd-center-title");
            if (titleEl) titleEl.textContent = "GOD MODE // " + n + " [" + s + "]";
            if (typeof appendMsg === "function") {
              appendMsg("ai", "GOD MODE CORE", "Активиран агент <strong>" + n + "</strong> (" + s + ") • Права: <strong>" + p + "</strong>.");
            }
          };
        });
      }

      document.getElementById("mrd-fac-btn").onclick = () => {
        const nameVal = (document.getElementById("mrd-fac-name").value || "").trim().toUpperCase();
        const specVal = (document.getElementById("mrd-fac-spec").value || "Network Security").trim();
        const toolsVal = (document.getElementById("mrd-fac-tools").value || "Zeek, Suricata, Wireshark").trim();
        if (!nameVal) return;
        const created = { name: nameVal, specialization: specVal + " [" + toolsVal + "]", permissions: "read-only" };
        armyList = [created].concat(armyList);
        renderArmyCards();
        if (typeof appendMsg === "function") {
          appendMsg("ai", "SECURITY FACTORY", "Създаден агент <strong>" + nameVal + "</strong> (" + specVal + " • " + toolsVal + ") в изолиран <strong>read-only</strong> режим.");
        }
      };

      fetch("/data/ecosystem-core.json", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d || !Array.isArray(d.autonomousArmy)) return;
          armyList = d.autonomousArmy;
          renderArmyCards();
        })
        .catch(() => {});
    }
`;

if (!code.includes("mrd-god-mode-panel")) {
  code = code.replace(
    /document\.body\.appendChild\(app\);/,
    "document.body.appendChild(app);\n" + godModeSnippet.trim()
  );
  fs.writeFileSync(consolePath, code, "utf8");
}

console.log("GOD MODE ecosystem panel integrated.");
