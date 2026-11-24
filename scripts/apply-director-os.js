const fs = require("fs");
const path = require("path");

const consolePath = path.join(__dirname, "..", "public", "marauder-live-console.js");
if (!fs.existsSync(consolePath)) {
  console.error("Missing public/marauder-live-console.js");
  process.exit(1);
}

let code = fs.readFileSync(consolePath, "utf8");

const directorSnippet = `
    // RED COMMAND — DIRECTOR OS управленски панел (одобрения, аварийно спиране, проекти и отдели)
    if (!document.getElementById("mrd-director-os-panel")) {
      const dirBox = document.createElement("section");
      dirBox.id = "mrd-director-os-panel";
      dirBox.className = "mrd-box";
      dirBox.innerHTML = \`
        <div class="mrd-box-title">
          <span>RED COMMAND — DIRECTOR OS // EXECUTIVE & APPROVALS</span>
          <span id="mrd-dir-estop-badge" style="color:#4ade80">STATUS: NOMINAL</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
          <button id="mrd-dir-estop-btn" class="mrd-btn" style="border-color:#ef4444">EMERGENCY STOP</button>
          <button id="mrd-dir-resume-btn" class="mrd-btn mrd-btn-green">RESUME NOMINAL</button>
          <select id="mrd-dir-view" class="mrd-search" style="width:auto">
            <option value="approvals">DIRECTOR APPROVALS</option>
            <option value="projects">PROJECTS (8 FIELDS)</option>
            <option value="departments">10 DEPARTMENTS & COUNCIL</option>
            <option value="audit">AUDIT LOG</option>
          </select>
        </div>
        <div id="mrd-dir-content" style="display:flex;flex-direction:column;gap:6px;max-height:260px;overflow-y:auto"></div>
      \`;
      app.insertBefore(dirBox, document.getElementById("mrd-bottom-bar") || null);

      let dirState = {
        emergencyStop: false,
        executiveCommand: [],
        departments: [],
        projects: [],
        approvalsQueue: [],
        auditLog: []
      };

      function logAuditClient(action, detail) {
        dirState.auditLog = dirState.auditLog || [];
        dirState.auditLog.unshift({
          ts: new Date().toISOString(),
          actor: "CEO / FOUNDER",
          action,
          detail
        });
      }

      function renderDirectorView() {
        const view = document.getElementById("mrd-dir-view").value;
        const container = document.getElementById("mrd-dir-content");
        const badge = document.getElementById("mrd-dir-estop-badge");
        if (!container) return;

        if (badge) {
          badge.textContent = dirState.emergencyStop ? "EMERGENCY STOP ACTIVE" : "STATUS: NOMINAL";
          badge.style.color = dirState.emergencyStop ? "#f87171" : "#4ade80";
        }

        if (view === "approvals") {
          container.innerHTML = (dirState.approvalsQueue || []).map((a, idx) => \`
            <div style="border:1px solid #2b1016;border-radius:7px;padding:8px;background:#0c101a;display:flex;flex-direction:column;gap:6px">
              <div style="display:flex;justify-content:space-between;gap:6px">
                <strong style="font-size:11px;color:#fff">\${a.id}: \${a.title}</strong>
                <span style="font-size:10px;color:#fca5a5">\${a.decision}</span>
              </div>
              <div style="font-size:10px;color:#9ca3af">Заявител: \${a.requestedBy} • Тип: \${a.actionType}</div>
              <div style="display:flex;flex-wrap:wrap;gap:4px">
                <button class="mrd-qbtn" data-dec="APPROVE" data-idx="\${idx}">APPROVE</button>
                <button class="mrd-qbtn" data-dec="REJECT" data-idx="\${idx}">REJECT</button>
                <button class="mrd-qbtn" data-dec="REVIEW" data-idx="\${idx}">REVIEW</button>
                <button class="mrd-qbtn" data-dec="EXECUTE" data-idx="\${idx}">EXECUTE</button>
                <button class="mrd-qbtn" data-dec="AUDIT" data-idx="\${idx}">AUDIT</button>
              </div>
            </div>
          \`).join("");

          container.querySelectorAll("[data-dec]").forEach((btn) => {
            btn.onclick = () => {
              const dec = btn.dataset.dec;
              const idx = Number(btn.dataset.idx);
              const item = dirState.approvalsQueue[idx];
              if (!item) return;
              if (dirState.emergencyStop && dec === "EXECUTE") {
                if (typeof appendMsg === "function") {
                  appendMsg("ai", "DIRECTOR OS", "Блокиран <strong>EXECUTE</strong> — активен е <strong>EMERGENCY STOP</strong>.");
                }
                return;
              }
              item.decision = dec;
              logAuditClient(dec, item.id + " (" + item.title + ")");
              renderDirectorView();
              if (typeof appendMsg === "function") {
                appendMsg("ai", "DIRECTOR OS", "Решение <strong>" + dec + "</strong> записано за <strong>" + item.id + "</strong>.");
              }
            };
          });
        } else if (view === "projects") {
          container.innerHTML = (dirState.projects || []).map((p) => \`
            <div style="border:1px solid #2b1016;border-radius:7px;padding:8px;background:#0c101a;font-size:11px;display:flex;flex-direction:column;gap:2px">
              <div><strong style="color:#fff">\${p.name}</strong> (\${p.id}) — <span style="color:#4ade80">\${p.status}</span></div>
              <div style="color:#fca5a5">Директор: \${p.director} • Агенти: \${(p.agents || []).join(", ")}</div>
              <div style="color:#cbd5e1">Бюджет: \${p.budget} • Срок: \${p.deadline}</div>
              <div style="color:#93c5fd">История: \${(p.history || []).join(" | ")}</div>
              <div style="color:#d1d5db">Отчет: \${p.report}</div>
            </div>
          \`).join("");
        } else if (view === "departments") {
          const execHtml = (dirState.executiveCommand || []).map((e) =>
            "<div style=\\"font-size:11px;color:#e5e7eb\\">• <strong style=\\"color:#fca5a5\\">" + e.role + ":</strong> " + e.holder + " — " + e.responsibility + "</div>"
          ).join("");
          const deptHtml = (dirState.departments || []).map((d) =>
            "<span style=\\"font-size:10px;padding:3px 6px;border:1px solid #2b1016;border-radius:5px;background:#111624;color:#cbd5e1\\">" + d + "</span>"
          ).join(" ");
          container.innerHTML = \`
            <div style="border:1px solid #2b1016;border-radius:7px;padding:8px;background:#0c101a;display:flex;flex-direction:column;gap:4px">
              <div style="font-size:11px;font-weight:800;color:#38bdf8">EXECUTIVE COMMAND & AI COUNCIL</div>
              \${execHtml}
              <div style="font-size:11px;font-weight:800;color:#fca5a5;margin-top:6px">RED SOFTWARE TEAM DEPARTMENTS (10)</div>
              <div style="display:flex;flex-wrap:wrap;gap:4px">\${deptHtml}</div>
            </div>
          \`;
        } else {
          container.innerHTML = (dirState.auditLog || []).slice(0, 20).map((entry) => \`
            <div style="border:1px solid #2b1016;border-radius:6px;padding:6px 8px;background:#0c101a;font-size:11px">
              <span style="color:#9ca3af">\${entry.ts}</span> • <strong style="color:#f87171">\${entry.action}</strong> • <span style="color:#fff">\${entry.detail}</span>
            </div>
          \`).join("");
        }
      }

      document.getElementById("mrd-dir-view").addEventListener("change", renderDirectorView);
      document.getElementById("mrd-dir-estop-btn").addEventListener("click", () => {
        dirState.emergencyStop = true;
        logAuditClient("EMERGENCY STOP", "Активирано аварийно спиране от CEO / FOUNDER");
        renderDirectorView();
        if (typeof appendMsg === "function") {
          appendMsg("ai", "DIRECTOR OS", "<strong>EMERGENCY STOP АКТИВИРАН</strong> — изпълнението е спряно, събитието е в одитния лог.");
        }
      });
      document.getElementById("mrd-dir-resume-btn").addEventListener("click", () => {
        dirState.emergencyStop = false;
        logAuditClient("CLEAR EMERGENCY STOP", "Възстановен номинален режим от CEO / FOUNDER");
        renderDirectorView();
        if (typeof appendMsg === "function") {
          appendMsg("ai", "DIRECTOR OS", "Номиналният режим на <strong>RED COMMAND — DIRECTOR OS</strong> е възстановен.");
        }
      });

      fetch("/data/director-os.json", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return;
          dirState = d;
          renderDirectorView();
        })
        .catch(() => {});
    }
`;

if (!code.includes("mrd-director-os-panel")) {
  code = code.replace(
    /document\.body\.appendChild\(app\);/,
    "document.body.appendChild(app);\n" + directorSnippet.trim()
  );
  fs.writeFileSync(consolePath, code, "utf8");
}

console.log("RED COMMAND — DIRECTOR OS integrated.");
