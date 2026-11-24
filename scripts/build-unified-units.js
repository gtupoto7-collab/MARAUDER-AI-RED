const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const top100Path = path.join(root, "data", "top100-cyber-agents.json");
const oldMalwarePath = path.join(root, "data", "malware-intelligence.json");
const outPath = path.join(root, "data", "unified-units-catalog.json");
const consolePath = path.join(root, "public", "marauder-live-console.js");

const fallbackOldMalware = [
  { name: "Emotet", summary: "Модулен троянец и loader за разпространение на допълнителни товари и кражба на данни." },
  { name: "TrickBot", summary: "Банков троянец и модулна платформа за разузнаване, достъп и странично движение." },
  { name: "QakBot (QBot)", summary: "Информационен крадец и loader с механизми за скриване и инжектиране в процеси." },
  { name: "Cobalt Strike Beacon", summary: "Агент за симулация на противник, команден канал и пост-експлоатация." },
  { name: "Mimikatz", summary: "Инструмент за изследване и извличане на идентификационни данни от паметта." },
  { name: "RansomHub", summary: "Съвременна ransomware операция с криптиране и екфилтрация на данни." },
  { name: "LockBit", summary: "Група и криптиращ софтуер с автоматизирано разпространение и изнудване." },
  { name: "Agent Tesla", summary: "Информационен крадец за пароли, ключове, клипборд и сесии от браузъри и пощи." },
  { name: "RedLine Stealer", summary: "Крадец на данни от браузъри, криптопортфейли и системна информация." },
  { name: "Mirai", summary: "Ботнет софтуер за IoT устройства с масово сканиране и мрежово натоварване." }
];

const units = [];

if (fs.existsSync(top100Path)) {
  const topData = JSON.parse(fs.readFileSync(top100Path, "utf8"));
  for (const a of (topData.agents || [])) {
    units.push({
      uid: `AI-${a.id}`,
      group: "TOP 100 AI",
      category: a.section || "AI Security",
      name: a.name,
      description: a.summary || "Специализиран AI агент за киберсигурност и анализ."
    });
  }
}

let oldCount = 0;
if (fs.existsSync(oldMalwarePath)) {
  const oldData = JSON.parse(fs.readFileSync(oldMalwarePath, "utf8"));
  const list = [].concat(oldData.aiFamilies || [], oldData.knownFamilies || []);
  list.forEach((item, idx) => {
    const name = typeof item === "string" ? item : (item.name || item.family || `Malware-${idx + 1}`);
    const desc = typeof item === "string"
      ? "Историческо/известно зловредно семейство — анализ на поведение, индикатори и защита."
      : (item.summary || item.description || item.role || "Анализ на заплаха, техники и защитни правила.");
    units.push({
      uid: `OLD-${idx + 1}`,
      group: "OLD MALWARE",
      category: item.level ? `Level ${item.level}` : "Legacy / Threat Family",
      name,
      description: desc
    });
    oldCount++;
  });
}

if (oldCount === 0) {
  fallbackOldMalware.forEach((m, idx) => {
    units.push({
      uid: `OLD-${idx + 1}`,
      group: "OLD MALWARE",
      category: "Legacy Threat Family",
      name: m.name,
      description: m.summary
    });
  });
}

fs.writeFileSync(outPath, JSON.stringify({
  totalUnits: units.length,
  top100Count: units.filter((u) => u.group === "TOP 100 AI").length,
  oldMalwareCount: units.filter((u) => u.group === "OLD MALWARE").length,
  units
}, null, 2), "utf8");

if (fs.existsSync(consolePath)) {
  let code = fs.readFileSync(consolePath, "utf8");
  const sideSummonCode = `
    // Страничен панел: Всеки стар malware и всеки от 100-те AI агента поотделно с описание и бутон за призоваване
    const rightAside = document.querySelector(".mrd-grid aside:last-of-type");
    if (rightAside && !document.getElementById("mrd-side-summon-box")) {
      const summonBox = document.createElement("div");
      summonBox.id = "mrd-side-summon-box";
      summonBox.style.cssText = "border-top:1px solid #2b1016;padding-top:8px;display:flex;flex-direction:column;gap:6px";
      summonBox.innerHTML = \`
        <div class="mrd-box-title">
          <span>ALL UNITS // SUMMON & RUN</span>
          <span id="mrd-summon-count" style="color:#4ade80">0</span>
        </div>
        <input id="mrd-summon-search" class="mrd-search" type="text" placeholder="Търси сред 100 AI + старите malware..." />
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px">
          <button class="mrd-qbtn" data-grp="">ВСИЧКИ</button>
          <button class="mrd-qbtn" data-grp="TOP 100 AI">100 AI</button>
          <button class="mrd-qbtn" data-grp="OLD MALWARE">OLD MALWARE</button>
        </div>
        <div id="mrd-summon-list" style="max-height:280px;overflow-y:auto;display:flex;flex-direction:column;gap:5px"></div>
      \`;
      rightAside.appendChild(summonBox);

      let unifiedUnits = [];
      let activeGroup = "";

      function summonUnit(u) {
        const titleEl = document.getElementById("mrd-center-title");
        if (titleEl) titleEl.textContent = "ACTIVE UNIT // " + u.name.toUpperCase() + " [" + u.group + "]";
        if (typeof appendMsg === "function") {
          appendMsg(
            "ai",
            "SUMMON ENGINE",
            "Призован <strong>" + u.name + "</strong> (" + u.group + " • " + u.category + ") — <em>" + u.description + "</em>. Стартиран в работен поток."
          );
        }
      }

      function renderSummonList() {
        const q = (document.getElementById("mrd-summon-search").value || "").trim().toLowerCase();
        const listEl = document.getElementById("mrd-summon-list");
        const countEl = document.getElementById("mrd-summon-count");
        if (!listEl) return;

        const filtered = unifiedUnits.filter((u) => {
          if (activeGroup && u.group !== activeGroup) return false;
          if (!q) return true;
          return (u.uid + " " + u.name + " " + u.group + " " + u.category + " " + u.description).toLowerCase().includes(q);
        });

        if (countEl) countEl.textContent = String(filtered.length);
        listEl.innerHTML = filtered.slice(0, 40).map((u, i) => \`
          <div style="border:1px solid #2b1016;border-radius:7px;padding:6px 8px;background:#0c101a;display:flex;flex-direction:column;gap:4px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:4px">
              <strong style="font-size:11px;color:#fff">\${u.name}</strong>
              <span style="font-size:9px;color:#fca5a5">\${u.group}</span>
            </div>
            <div style="font-size:10px;color:#cbd5e1;line-height:1.3">\${u.description}</div>
            <button class="mrd-btn" style="padding:4px 8px;font-size:10px" data-sum-idx="\${i}">ПРИЗОВИ ДА БАЧКА</button>
          </div>
        \`).join("");

        listEl.querySelectorAll("[data-sum-idx]").forEach((btn) => {
          btn.onclick = () => {
            const idx = Number(btn.dataset.sumIdx);
            if (filtered[idx]) summonUnit(filtered[idx]);
          };
        });
      }

      document.getElementById("mrd-summon-search").addEventListener("input", renderSummonList);
      summonBox.querySelectorAll("[data-grp]").forEach((b) => {
        b.onclick = () => { activeGroup = b.dataset.grp; renderSummonList(); };
      });

      fetch("/data/unified-units-catalog.json", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d || !Array.isArray(d.units)) return;
          unifiedUnits = d.units;
          renderSummonList();
        })
        .catch(() => {});
    }
  `;

  if (!code.includes("mrd-side-summon-box")) {
    code = code.replace(
      /document\.body\.appendChild\(app\);/,
      "document.body.appendChild(app);\n" + sideSummonCode.trim()
    );
    fs.writeFileSync(consolePath, code, "utf8");
  }
}

console.log("Built unified catalog:", outPath, "Total:", units.length);
