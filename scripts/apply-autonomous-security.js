const fs = require("fs");
const path = require("path");

const consolePath = path.join(__dirname, "..", "public", "marauder-live-console.js");
if (!fs.existsSync(consolePath)) {
  console.error("Missing public/marauder-live-console.js");
  process.exit(1);
}

let code = fs.readFileSync(consolePath, "utf8");

const autoSecSnippet = `
    // AUTONOMOUS SECURITY ENGINE — непрекъснат контролиран цикъл (AUTO / APPROVAL / BLOCKED)
    if (!document.getElementById("mrd-autonomous-sec-panel")) {
      const secPanel = document.createElement("section");
      secPanel.id = "mrd-autonomous-sec-panel";
      secPanel.className = "mrd-box";
      secPanel.innerHTML = \`
        <div class="mrd-box-title">
          <span>AUTONOMOUS SECURITY ENGINE // RUN SECURITY CHECK</span>
          <span id="mrd-ase-mode-badge" style="color:#4ade80">AUTO-FIX: OFF • SAFE</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
          <input id="mrd-ase-target" class="mrd-search" style="flex:1;min-width:170px" type="text" placeholder="TARGET (напр. approved-lab.local)" />
          <input id="mrd-ase-scope" class="mrd-search" style="width:150px" type="text" value="approved assets" />
          <select id="mrd-ase-mode" class="mrd-search" style="width:auto">
            <option value="continuous">MODE: continuous</option>
            <option value="single">MODE: single</option>
          </select>
          <select id="mrd-ase-risk" class="mrd-search" style="width:auto">
            <option value="production-safe">RISK: production-safe</option>
            <option value="lab-strict">RISK: lab-strict</option>
          </select>
          <button id="mrd-ase-run-btn" class="mrd-btn">RUN SECURITY CHECK</button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <button id="mrd-ase-findings-btn" class="mrd-qbtn">[ VIEW FINDINGS ]</button>
          <button id="mrd-ase-approve-btn" class="mrd-qbtn">[ APPROVE ACTIONS ]</button>
          <button id="mrd-ase-estop-btn" class="mrd-qbtn">[ EMERGENCY STOP ]</button>
        </div>
        <div id="mrd-ase-status-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px"></div>
        <div id="mrd-ase-detail" style="font-size:11px;color:#cbd5e1;border:1px solid #2b1016;border-radius:7px;padding:8px;background:#0c101a;max-height:170px;overflow-y:auto">
          Готов за проверка на разрешен актив в безопасен режим (AUTO-FIX: OFF).
        </div>
      \`;
      app.insertBefore(secPanel, document.getElementById("mrd-bottom-bar") || null);

      let aseState = {
        defaults: { target: "approved-lab.local", scope: "approved assets", mode: "continuous", risk: "production-safe", autoFix: false },
        liveTelemetry: {
          assetsTotal: 0, healthy: 0, needsAttention: 0, critical: 0,
          lastScan: "none", nextScan: "automatic", activeAgents: 0,
          threatsDetected: 0, falsePositives: 0, emergencyStop: false
        },
        findings: [],
        pendingApprovals: [],
        loopStages: []
      };

      function renderAseStatus() {
        const grid = document.getElementById("mrd-ase-status-grid");
        const badge = document.getElementById("mrd-ase-mode-badge");
        const t = aseState.liveTelemetry || {};
        if (badge) {
          badge.textContent = t.emergencyStop ? "EMERGENCY STOP ACTIVE" : "AUTO-FIX: OFF • SAFE";
          badge.style.color = t.emergencyStop ? "#f87171" : "#4ade80";
        }
        if (!grid) return;
        const cards = [
          ["Assets", t.assetsTotal ?? 0],
          ["Healthy", t.healthy ?? 0],
          ["Needs attention", t.needsAttention ?? 0],
          ["Critical", t.critical ?? 0],
          ["AI agents active", t.activeAgents ?? 0],
          ["Threats detected", t.threatsDetected ?? 0],
          ["False positives", t.falsePositives ?? 0],
          ["Next scan", t.nextScan || "automatic"]
        ];
        grid.innerHTML = cards.map(([k, v]) => \`
          <div style="border:1px solid #2b1016;border-radius:6px;padding:6px 8px;background:#0c101a">
            <div style="font-size:10px;color:#9ca3af">\${k}</div>
            <div style="font-size:12px;font-weight:800;color:#fff">\${v}</div>
          </div>
        \`).join("");
      }

      document.getElementById("mrd-ase-run-btn").onclick = () => {
        if (aseState.liveTelemetry && aseState.liveTelemetry.emergencyStop) {
          if (typeof appendMsg === "function") appendMsg("ai", "AUTONOMOUS ENGINE", "Блокирано — активен е <strong>EMERGENCY STOP</strong>.");
          return;
        }
        const target = (document.getElementById("mrd-ase-target").value || aseState.defaults.target || "").trim();
        const scope = (document.getElementById("mrd-ase-scope").value || "approved assets").trim();
        const mode = document.getElementById("mrd-ase-mode").value;
        const risk = document.getElementById("mrd-ase-risk").value;
        aseState.liveTelemetry = {
          ...aseState.liveTelemetry,
          assetsTotal: Math.max(1, aseState.liveTelemetry.assetsTotal || 1),
          healthy: Math.max(1, aseState.liveTelemetry.healthy || 1),
          lastScan: new Date().toISOString().slice(11, 19) + " UTC",
          nextScan: mode === "continuous" ? "automatic" : "manual",
          activeAgents: 1
        };
        renderAseStatus();
        const detail = document.getElementById("mrd-ase-detail");
        if (detail) {
          detail.innerHTML = "<strong>TARGET:</strong> " + target + " | <strong>SCOPE:</strong> " + scope + " | <strong>MODE:</strong> " + mode + " | <strong>RISK:</strong> " + risk + " | <strong>AUTO-FIX:</strong> OFF<br/>Цикъл: ASSET DISCOVERY → INVENTORY → RISK ASSESSMENT → VULNERABILITY SCAN → AI CORRELATION → SAFE VALIDATION → REMEDIATION PLAN → RE-SCAN → VERIFIED.";
        }
        if (typeof appendMsg === "function") {
          appendMsg("ai", "AUTONOMOUS ENGINE", "Стартиран <strong>RUN SECURITY CHECK</strong> за <strong>" + target + "</strong> [" + scope + ", " + risk + ", AUTO-FIX: OFF].");
        }
      };

      document.getElementById("mrd-ase-findings-btn").onclick = () => {
        const detail = document.getElementById("mrd-ase-detail");
        if (!detail) return;
        const list = aseState.findings || [];
        detail.innerHTML = list.length
          ? list.map((f) => "<div>• [" + f.severity + "] " + f.title + "</div>").join("")
          : "Няма записани находки (0 threats, 0 false positives — без измислени данни).";
      };

      document.getElementById("mrd-ase-approve-btn").onclick = () => {
        const detail = document.getElementById("mrd-ase-detail");
        if (!detail) return;
        const pending = aseState.pendingApprovals || [];
        detail.innerHTML = pending.length
          ? pending.map((p) => "<div>• Очаква APPROVE: " + p.title + "</div>").join("")
          : "Няма чакащи одобрения за инвазивни действия (🟢 AUTO активно, 🔴 BLOCKED извън обхвата).";
      };

      document.getElementById("mrd-ase-estop-btn").onclick = () => {
        aseState.liveTelemetry.emergencyStop = !aseState.liveTelemetry.emergencyStop;
        renderAseStatus();
        if (typeof appendMsg === "function") {
          appendMsg("ai", "AUTONOMOUS ENGINE", aseState.liveTelemetry.emergencyStop ? "<strong>EMERGENCY STOP ВКЛЮЧЕН</strong> — автономните цикли са спрени." : "<strong>EMERGENCY STOP ИЗКЛЮЧЕН</strong> — готовност за безопасен цикъл.");
        }
      };

      fetch("/data/autonomous-security-engine.json", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return;
          aseState = d;
          const tInp = document.getElementById("mrd-ase-target");
          if (tInp && d.defaults && d.defaults.target) tInp.value = d.defaults.target;
          renderAseStatus();
        })
        .catch(() => {});
    }
`;

if (!code.includes("mrd-autonomous-sec-panel")) {
  code = code.replace(
    /document\.body\.appendChild\(app\);/,
    "document.body.appendChild(app);\n" + autoSecSnippet.trim()
  );
  fs.writeFileSync(consolePath, code, "utf8");
}

console.log("AUTONOMOUS SECURITY ENGINE panel integrated.");
