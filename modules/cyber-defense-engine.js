const fs = require("fs");
const path = require("path");

const UPGRADES_PATH = path.join(__dirname, "..", "data", "marauder-100-upgrades.json");

function loadDefenseUpgrades() {
  if (!fs.existsSync(UPGRADES_PATH)) {
    return { engine: "MARAUDER CYBER DEFENSE ENGINE", priorityTop10: [], upgrades: [] };
  }
  return JSON.parse(fs.readFileSync(UPGRADES_PATH, "utf8"));
}

function queryDefenseUpgrades(query = "", section = "", onlyPriority10 = false) {
  const data = loadDefenseUpgrades();
  const q = String(query || "").trim().toLowerCase();
  const sec = String(section || "").trim();
  const topSet = new Set((data.priorityTop10 || []).map((n) => String(n).toLowerCase()));

  const items = (data.upgrades || []).filter((u) => {
    if (sec && u.section !== sec) return false;
    if (onlyPriority10 && !topSet.has(String(u.name || "").toLowerCase())) return false;
    if (!q) return true;
    return `${u.id || ""} ${u.name || ""} ${u.section || ""} ${u.purpose || ""}`.toLowerCase().includes(q);
  });

  return {
    engine: data.engine,
    total: items.length,
    items
  };
}

module.exports = {
  loadDefenseUpgrades,
  queryDefenseUpgrades
};
