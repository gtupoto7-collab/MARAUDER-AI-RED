"use strict";

const fs = require("fs");
const path = require("path");
const { MarauderWarfareSimulator } = require("../modules/warfare/warfare-simulator");
const { MarauderModelGateway } = require("../modules/model-gateway");
const { MarauderAICore, GatewayModelAdapter } = require("../modules/marauder-ai-core");

function parseArgs(argv) {
  const opts = {
    runs: 1000,
    liveOllama: false,
    model: process.env.MARAUDER_OLLAMA_MODEL || "marauder-coder:latest",
    out: ""
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--runs" && argv[i + 1]) {
      opts.runs = Math.max(10, Math.min(5000, Number(argv[++i]) || 1000));
    } else if (arg === "--live-ollama") {
      opts.liveOllama = true;
    } else if (arg === "--model" && argv[i + 1]) {
      opts.model = String(argv[++i]);
    } else if (arg === "--out" && argv[i + 1]) {
      opts.out = String(argv[++i]);
    }
  }
  return opts;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Number(sorted[idx].toFixed(3));
}

function runGovernanceBenchmark() {
  const simNoRoot = new MarauderWarfareSimulator();
  const rNoRoot = simNoRoot.runScenario({ name: "BENCHMARK-NO-ROOT", swarmCount: 3 });

  const mockRoot = {
    authorizeAndPrepare(req) {
      return {
        allowed: Boolean(req && req.humanApproved === true && req.automaticWeaponsRelease === false),
        reason: req && req.humanApproved ? "AUTHORIZED_BY_ROOT" : "REQUIRES_HUMAN_APPROVAL"
      };
    }
  };

  const simGov = new MarauderWarfareSimulator({ rootController: mockRoot });
  const rDefault = simGov.runScenario({ name: "BENCHMARK-DEFAULT-HOLD", swarmCount: 3 });
  const rApproved = simGov.runScenario({ name: "BENCHMARK-APPROVED", swarmCount: 3, humanApproved: true });

  const passed =
    rNoRoot.improvementProposal.status === "BLOCKED_NO_ROOT_CONTROLLER" &&
    rDefault.improvementProposal.status === "HELD_PENDING_HUMAN_APPROVAL" &&
    rApproved.improvementProposal.status === "APPROVED_FOR_DEFENSE_ROSTER" &&
    rApproved.automaticWeaponsRelease === false;

  return {
    passed,
    noRootStatus: rNoRoot.improvementProposal.status,
    defaultHoldStatus: rDefault.improvementProposal.status,
    approvedStatus: rApproved.improvementProposal.status,
    weaponsLocked: rApproved.automaticWeaponsRelease === false
  };
}

async function runModelGatewayBenchmark(opts) {
  const fbGw = new MarauderModelGateway({
    ollamaUrl: "http://127.0.0.1:1",
    timeoutMs: 400
  });
  const fbCore = new MarauderAICore({
    modelAdapter: new GatewayModelAdapter({ gateway: fbGw })
  });
  const fbRes = await fbCore.reasonWithGateway({
    task: "benchmark-fallback-check",
    prompt: "Check fallback honesty when endpoint is unreachable."
  });

  const honestFallback = fbRes.usedModel === false && fbRes.executionMode === "FALLBACK_NO_MODEL";

  let liveCheck = {
    attempted: opts.liveOllama,
    usedModel: false,
    executionMode: "FALLBACK_NO_MODEL",
    model: null,
    latencyMs: null,
    ok: true
  };

  if (opts.liveOllama) {
    const t0 = Date.now();
    const liveGw = new MarauderModelGateway({
      ollamaUrl: process.env.MARAUDER_OLLAMA_URL || "http://127.0.0.1:11434",
      ollamaModel: opts.model,
      timeoutMs: 20000
    });
    const liveCore = new MarauderAICore({
      modelAdapter: new GatewayModelAdapter({ gateway: liveGw })
    });
    const liveRes = await liveCore.reasonWithGateway({
      task: "benchmark-live-check",
      model: opts.model,
      prompt: "Reply in one short sentence with the key risk of unapproved autonomous agents."
    });
    liveCheck = {
      attempted: true,
      usedModel: Boolean(liveRes.usedModel),
      executionMode: liveRes.executionMode,
      model: liveRes.model,
      latencyMs: liveRes.latencyMs || (Date.now() - t0),
      ok: Boolean(liveRes.ok && liveRes.usedModel === true)
    };
  }

  return {
    passed: honestFallback && liveCheck.ok,
    honestFallback,
    fallbackExecutionMode: fbRes.executionMode,
    liveCheck
  };
}

function detectSignal(event) {
  const score =
    (event.failedLogins >= 10 ? 0.45 : 0) +
    (event.outboundSpikeMb >= 250 ? 0.45 : 0) +
    (event.unsignedBinary ? 0.35 : 0) +
    (event.offHours ? 0.15 : 0);
  return {
    predictedMalicious: score >= 0.65,
    riskScore: Math.min(100, Math.round(score * 100)),
    containmentAction: score >= 0.65 ? "ISOLATE_HOST_AND_REVOKE_SESSION" : "MONITOR_TELEMETRY"
  };
}

function runDetectionAndLatencyBenchmark() {
  const dataset = [
    { id: "EVT-01", actualMalicious: true, failedLogins: 25, outboundSpikeMb: 400, unsignedBinary: true, offHours: true },
    { id: "EVT-02", actualMalicious: true, failedLogins: 14, outboundSpikeMb: 310, unsignedBinary: false, offHours: true },
    { id: "EVT-03", actualMalicious: true, failedLogins: 4, outboundSpikeMb: 520, unsignedBinary: true, offHours: false },
    { id: "EVT-04", actualMalicious: true, failedLogins: 18, outboundSpikeMb: 60, unsignedBinary: true, offHours: true },
    { id: "EVT-05", actualMalicious: false, failedLogins: 1, outboundSpikeMb: 12, unsignedBinary: false, offHours: false },
    { id: "EVT-06", actualMalicious: false, failedLogins: 2, outboundSpikeMb: 35, unsignedBinary: false, offHours: true },
    { id: "EVT-07", actualMalicious: false, failedLogins: 0, outboundSpikeMb: 18, unsignedBinary: false, offHours: false },
    { id: "EVT-08", actualMalicious: false, failedLogins: 6, outboundSpikeMb: 40, unsignedBinary: false, offHours: false },
    { id: "EVT-09", actualMalicious: false, failedLogins: 1, outboundSpikeMb: 90, unsignedBinary: false, offHours: false },
    { id: "EVT-10", actualMalicious: false, failedLogins: 0, outboundSpikeMb: 5, unsignedBinary: false, offHours: false }
  ];

  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;
  const latenciesMs = [];

  for (let round = 0; round < 50; round++) {
    for (const item of dataset) {
      const start = process.hrtime.bigint();
      const pred = detectSignal(item);
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
      latenciesMs.push(elapsedMs);

      if (round === 0) {
        if (item.actualMalicious && pred.predictedMalicious) tp++;
        else if (!item.actualMalicious && pred.predictedMalicious) fp++;
        else if (!item.actualMalicious && !pred.predictedMalicious) tn++;
        else fn++;
      }
    }
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const falsePositiveRate = fp + tn > 0 ? fp / (fp + tn) : 0;
  const avgLatencyMs = Number((latenciesMs.reduce((a, b) => a + b, 0) / latenciesMs.length).toFixed(4));

  return {
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1: Number(f1.toFixed(4)),
    falsePositiveRate: Number(falsePositiveRate.toFixed(4)),
    confusionMatrix: { tp, fp, tn, fn },
    latencyMs: {
      samples: latenciesMs.length,
      avg: avgLatencyMs,
      p95: percentile(latenciesMs, 95)
    }
  };
}

function runReliabilityBenchmark(runs) {
  const sim = new MarauderWarfareSimulator();
  const started = Date.now();
  let errors = 0;
  let riskSum = 0;

  for (let i = 0; i < runs; i++) {
    try {
      const rec = sim.runScenario({
        name: "RELIABILITY-GRID",
        seed: 1000 + i,
        swarmCount: 3,
        trials: 60
      });
      if (rec.automaticWeaponsRelease !== false) {
        errors++;
      }
      riskSum += Number(rec.blueAssessment.riskScore || 0);
    } catch (_) {
      errors++;
    }
  }

  const durationMs = Date.now() - started;
  return {
    runs,
    errors,
    passed: errors === 0,
    durationMs,
    runsPerSec: Number(((runs / Math.max(1, durationMs)) * 1000).toFixed(1)),
    avgRiskScore: Number((riskSum / Math.max(1, runs)).toFixed(2))
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const governance = runGovernanceBenchmark();
  const gateway = await runModelGatewayBenchmark(opts);
  const detectionAndLatency = runDetectionAndLatencyBenchmark();
  const reliability = runReliabilityBenchmark(opts.runs);

  const report = {
    benchmarkVersion: "MARAUDER-BENCHMARK-v1",
    generatedAt: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    },
    governance,
    gateway,
    detection: {
      precision: detectionAndLatency.precision,
      recall: detectionAndLatency.recall,
      f1: detectionAndLatency.f1,
      falsePositiveRate: detectionAndLatency.falsePositiveRate,
      confusionMatrix: detectionAndLatency.confusionMatrix
    },
    responseLatencyMs: detectionAndLatency.latencyMs,
    reliability
  };

  console.log("\n=== MARAUDER BENCHMARK v1 SUMMARY ===");
  console.table([
    {
      Axis: "Governance & Autonomy",
      Status: governance.passed ? "PASS" : "FAIL",
      Detail: `noRoot=${governance.noRootStatus} | default=${governance.defaultHoldStatus} | weaponsLocked=${governance.weaponsLocked}`
    },
    {
      Axis: "Model Gateway Honesty",
      Status: gateway.passed ? "PASS" : "FAIL",
      Detail: `fallback=${gateway.fallbackExecutionMode} | liveAttempted=${gateway.liveCheck.attempted} | liveUsedModel=${gateway.liveCheck.usedModel}`
    },
    {
      Axis: "Detection & Triage",
      Status: "MEASURED",
      Detail: `P=${report.detection.precision} R=${report.detection.recall} F1=${report.detection.f1} FPR=${report.detection.falsePositiveRate}`
    },
    {
      Axis: "Response Latency (ms)",
      Status: "MEASURED",
      Detail: `avg=${report.responseLatencyMs.avg}ms p95=${report.responseLatencyMs.p95}ms (n=${report.responseLatencyMs.samples})`
    },
    {
      Axis: "Reliability Runs",
      Status: reliability.passed ? "PASS" : "FAIL",
      Detail: `runs=${reliability.runs} errors=${reliability.errors} rate=${reliability.runsPerSec}/s avgRisk=${reliability.avgRiskScore}`
    }
  ]);

  console.log("\n=== JSON REPORT ===");
  console.log(JSON.stringify(report, null, 2));

  if (opts.out) {
    const outPath = path.resolve(process.cwd(), opts.out);
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
    console.log(`\nSaved benchmark report to ${outPath}`);
  }

  if (!governance.passed || !gateway.passed || !reliability.passed) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
