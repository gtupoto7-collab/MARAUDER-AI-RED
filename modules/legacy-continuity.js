const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const LEGACY_PATH = path.join(ROOT, "data", "legacy-architecture.json");

function loadLegacyArchitecture() {
  if (!fs.existsSync(LEGACY_PATH)) {
    return { organization: "RED SOFTWARE TEAM", founded: 2026, continuityPillars: [] };
  }
  return JSON.parse(fs.readFileSync(LEGACY_PATH, "utf8"));
}

function verifySystemContinuity() {
  const requiredFiles = [
    "data/top100-cyber-agents.json",
    "data/marauder-100-upgrades.json",
    "data/agent-registry.json",
    "data/tool-registry.json",
    "data/permissions.json",
    "data/ecosystem-core.json",
    "data/director-os.json",
    "data/apocalypse-edition.json",
    "data/apocalypse-cyber-engine.json",
    "data/legacy-architecture.json",
    "public/marauder-live-console.js"
  ];

  const checks = requiredFiles.map((rel) => {
    const full = path.join(ROOT, rel);
    const exists = fs.existsSync(full);
    let validJson = true;
    if (exists && rel.endsWith(".json")) {
      try {
        JSON.parse(fs.readFileSync(full, "utf8"));
      } catch {
        validJson = false;
      }
    }
    return { file: rel, exists, validJson };
  });

  const allHealthy = checks.every((c) => c.exists && c.validJson);
  return {
    ok: allHealthy,
    checkedAt: new Date().toISOString(),
    totalChecks: checks.length,
    failed: checks.filter((c) => !c.exists || !c.validJson),
    checks
  };
}

module.exports = {
  loadLegacyArchitecture,
  verifySystemContinuity
};
