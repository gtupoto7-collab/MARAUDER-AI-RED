const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(__dirname, "..", "data", "top100-cyber-agents.json");

function loadCyberAgents() {
  if (!fs.existsSync(DATA_PATH)) {
    return { agents: [], favorites15: [], catalogSources: [], orchestrator: null };
  }
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function searchCyberAgents(query = "", filters = {}) {
  const data = loadCyberAgents();
  const q = String(query || "").trim().toLowerCase();
  const sectionFilter = String(filters.section || "").trim().toLowerCase();
  const favNames = new Set((data.favorites15 || []).map((f) => String(f.name).toLowerCase()));

  const results = (data.agents || []).filter((item) => {
    const sec = String(item.section || "").toLowerCase();
    const hay = `${item.id || ""} ${item.name || ""} ${item.section || ""} ${item.summary || ""}`.toLowerCase();
    if (sectionFilter && !sec.includes(sectionFilter)) return false;
    if (filters.onlyFavorites && !favNames.has(String(item.name || "").toLowerCase())) return false;
    if (q && !hay.includes(q)) return false;
    return true;
  });

  return {
    total: results.length,
    results,
    favoritesCount: favNames.size,
    sources: data.catalogSources || []
  };
}

module.exports = {
  loadCyberAgents,
  searchCyberAgents
};
