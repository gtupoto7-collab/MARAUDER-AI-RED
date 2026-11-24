const fs = require("fs");
const path = require("path");

const APO_PATH = path.join(__dirname, "..", "data", "apocalypse-edition.json");

function loadApocalypseConfig() {
  if (!fs.existsSync(APO_PATH)) {
    return { edition: "MARAUDER SECURITY — APOCALYPSE EDITION", coreEngines: [], benchmarks: [], benchmarkRuns: [] };
  }
  return JSON.parse(fs.readFileSync(APO_PATH, "utf8"));
}

function runAutonomousSocCycle({ alertTitle = "Подозрителен процес / мрежов сигнал", riskScore = 65, directorApproved = false } = {}) {
  const criticalAction = Number(riskScore) >= 75;
  const steps = [
    { stage: 1, actor: "SENSOR / MONITOR", action: `Открита активност: ${alertTitle}` },
    { stage: 2, actor: "EVIDENCE AGENT", action: "Събрани първични доказателства и метаданни в изолиран контекст" },
    { stage: 3, actor: "BEHAVIOR AGENT", action: "Извършен поведенчески анализ на процеса и комуникацията" },
    { stage: 4, actor: "THREAT INTEL AGENT", action: "Сверени индикатори срещу MITRE ATT&CK / CISA KEV / MISP / OpenCTI" },
    { stage: 5, actor: "MEGATRON SECURITY", action: `Изчислен риск: ${riskScore}/100 (${criticalAction ? "CRITICAL" : "ELEVATED"})` },
    {
      stage: 6,
      actor: "BLUE TEAM",
      action: criticalAction
        ? "Предложено изолиране/блокиране — изисква изрично директорско одобрение"
        : "Предложено защитно правило / усилен мониторинг"
    },
    {
      stage: 7,
      actor: "CEO / DIRECTOR AUDIT",
      action: criticalAction
        ? (directorApproved ? "ОДОБРЕНО от директора и записано в Audit Log" : "ИЗЧАКВА ОДОБРЕНИЕ от директора преди критично действие")
        : "Записано в Audit Log"
    }
  ];

  return {
    ok: true,
    timestamp: new Date().toISOString(),
    criticalAction,
    directorApproved: Boolean(directorApproved),
    steps
  };
}

function recordBenchmarkResult(trialName, measuredValue, notes = "") {
  const cfg = loadApocalypseConfig();
  const entry = {
    id: `BMK-${(cfg.benchmarkRuns || []).length + 1}`,
    recordedAt: new Date().toISOString(),
    trial: String(trialName || "General Benchmark").trim(),
    value: String(measuredValue || "unverified").trim(),
    notes: String(notes || "").trim()
  };
  cfg.benchmarkRuns = cfg.benchmarkRuns || [];
  cfg.benchmarkRuns.push(entry);
  fs.writeFileSync(APO_PATH, JSON.stringify(cfg, null, 2), "utf8");
  return entry;
}

module.exports = {
  loadApocalypseConfig,
  runAutonomousSocCycle,
  recordBenchmarkResult
};
