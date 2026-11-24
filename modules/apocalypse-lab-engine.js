const fs = require("fs");
const path = require("path");

const LAB_PATH = path.join(__dirname, "..", "data", "apocalypse-cyber-engine.json");

function loadApocalypseLab() {
  if (!fs.existsSync(LAB_PATH)) {
    return {
      engine: "MARAUDER APOCALYPSE CYBER ENGINE",
      divisions: [],
      hackingDivision: [],
      malwareApocalypse: [],
      autonomousCyberAgents: []
    };
  }
  return JSON.parse(fs.readFileSync(LAB_PATH, "utf8"));
}

function createLabJob({ division = "HACKING LAB", moduleName = "", targetAuthorized = false, targetLabel = "isolated-lab" } = {}) {
  if (!targetAuthorized) {
    return {
      ok: false,
      error: "Блокирано: активни тестове и лабораторни задачи изискват изрично потвърждение за разрешена цел."
    };
  }
  return {
    ok: true,
    job: {
      id: `LAB-${Date.now().toString(36).toUpperCase()}`,
      division,
      module: moduleName || "Lab Check",
      target: targetLabel,
      leastPrivilege: true,
      auditRequired: true
    }
  };
}

module.exports = {
  loadApocalypseLab,
  createLabJob
};
