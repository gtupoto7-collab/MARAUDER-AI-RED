const fs = require("fs");
const path = require("path");
const { ReplayEngine, Parliament } = require("./black-box-parliament");

const BLACKBOX_DIR = path.join(__dirname, "..", "data", "blackbox-v2");
const ASSETS_FILE = path.join(__dirname, "..", "data", "assets", "assets-8k.json");
const OUT_DIR = path.join(__dirname, "..", "data", "benchmarks");

class MarauderBenchmark {
  constructor() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    this.replayer = new ReplayEngine(new Parliament());
  }

  run() {
    let assetsCount = 0;
    if (fs.existsSync(ASSETS_FILE)) {
      const a = JSON.parse(fs.readFileSync(ASSETS_FILE, "utf8"));
      assetsCount = Array.isArray(a.items) ? a.items.length : 0;
    }

    const missionFiles = fs.existsSync(BLACKBOX_DIR)
      ? fs.readdirSync(BLACKBOX_DIR).filter((f) => f.endsWith(".json"))
      : [];

    let totalMissions = 0;
    let verifiedFindings = 0;
    let unverifiedOrBlocked = 0;
    let missionFailures = 0;
    let replayMatches = 0;
    let replayTotal = 0;
    const durationsMs = [];

    for (const file of missionFiles) {
      const full = path.join(BLACKBOX_DIR, file);
      const data = JSON.parse(fs.readFileSync(full, "utf8"));
      totalMissions += 1;

      const evCount = Array.isArray(data.evidences) ? data.evidences.length : 0;
      const verifiedEv = (data.evidences || []).filter((e) => e.payload && e.payload.verified).length;
      verifiedFindings += verifiedEv;
      if (verifiedEv === 0) unverifiedOrBlocked += 1;

      if (data.mission && (data.mission.status === "FAILED" || data.mission.status === "REJECTED")) {
        missionFailures += 1;
      }

      if (data.mission && data.mission.startedAt && data.mission.completedAt) {
        const dt = new Date(data.mission.completedAt) - new Date(data.mission.startedAt);
        if (!Number.isNaN(dt) && dt >= 0) durationsMs.push(dt);
      }

      try {
        const rep = this.replayer.replay(data);
        replayTotal += 1;
        if (rep.matchesOriginal) replayMatches += 1;
      } catch (_) {
        replayTotal += 1;
      }
    }

    const falsePositiveRate =
      verifiedFindings + unverifiedOrBlocked > 0
        ? Number(((unverifiedOrBlocked / (verifiedFindings + unverifiedOrBlocked)) * 100).toFixed(2))
        : 0;

    const replayConsistency =
      replayTotal > 0 ? Number(((replayMatches / replayTotal) * 100).toFixed(2)) : 100;

    const meanDetectionMs =
      durationsMs.length > 0
        ? Math.round(durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length)
        : 0;

    const report = {
      generatedAt: new Date().toISOString(),
      platform: "MARAUDER (BG AI Security Automation)",
      metrics: {
        assetsTracked: assetsCount,
        assetsTargetCapacity: 8000,
        missionsAudited: totalMissions,
        verifiedFindings,
        unverifiedOrBlockedFindings: unverifiedOrBlocked,
        falsePositiveRatePct: falsePositiveRate,
        meanDetectionTimeMs: meanDetectionMs,
        meanRemediationTimeMs: null,
        replayConsistencyPct: replayConsistency,
        missionFailures
      }
    };

    const md = [
      `# MARAUDER BENCHMARK (${report.generatedAt})`,
      "",
      `- Assets tracked:        ${report.metrics.assetsTracked} / ${report.metrics.assetsTargetCapacity}`,
      `- Missions audited:      ${report.metrics.missionsAudited}`,
      `- Verified findings:     ${report.metrics.verifiedFindings}`,
      `- False-positive rate:   ${report.metrics.falsePositiveRatePct}%`,
      `- Mean detection time:   ${report.metrics.meanDetectionTimeMs} ms`,
      `- Mean remediation time: ${report.metrics.meanRemediationTimeMs ?? "PENDING_REMEDIATION_RUNS"}`,
      `- Replay consistency:    ${report.metrics.replayConsistencyPct}%`,
      `- Mission failures:      ${report.metrics.missionFailures}`
    ].join("\n");

    const mdPath = path.join(OUT_DIR, "latest-benchmark.md");
    const jsonPath = path.join(OUT_DIR, "latest-benchmark.json");
    fs.writeFileSync(mdPath, md);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    return { report, md, mdPath, jsonPath };
  }
}

module.exports = MarauderBenchmark;
