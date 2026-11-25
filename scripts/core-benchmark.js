"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { SecurityControlPlane } = require("../core/control-plane");
const { buildControlPlaneDiagnostics } = require("../core/control-plane-status");
const { MarauderAICore, GatewayModelAdapter } = require("../modules/marauder-ai-core");
const { MarauderModelGateway } = require("../modules/model-gateway");

async function runCoreBenchmark(options = {}) {
  const iterations = Math.max(1, Number(options.iterations || process.env.MARAUDER_BENCH_ITERS || 3));
  const modelTimeoutMs = Math.max(
    500,
    Number(options.modelTimeoutMs || process.env.MARAUDER_BENCH_MODEL_TIMEOUT_MS || 6000)
  );
  const preferredModel =
    options.model || process.env.MARAUDER_BENCH_MODEL || process.env.MARAUDER_CODE_AUDIT_MODEL || null;

  const snapDir = fs.mkdtempSync(path.join(os.tmpdir(), "marauder-core-bench-"));

  const gateway = new MarauderModelGateway({
    ollamaUrl: process.env.MARAUDER_OLLAMA_URL || "http://127.0.0.1:11434",
    timeoutMs: modelTimeoutMs
  });
  const aiCore = new MarauderAICore({
    modelAdapter: new GatewayModelAdapter({ gateway })
  });

  const cp = new SecurityControlPlane({ aiCore });
  cp.registerPlugin({
    name: "bench-soc-guard",
    version: "1.0.0",
    domain: "DEFENSE",
    agentProfile: {
      domain: "SOC",
      capabilities: ["triage", "telemetry", "audit", "guard"],
      defaultTaskType: "warfare-triage",
      requiresApproval: false
    },
    executor: async (task) => {
      const gwOut = await aiCore.reasonWithGateway({
        task: "defensive-triage",
        model: preferredModel || undefined,
        timeoutMs: modelTimeoutMs,
        prompt: [
          "You are a defensive SOC triage assistant in MARAUDER.",
          "Provide a concise defensive check and verification note without offensive payloads.",
          `Task: ${task.title}`
        ].join("\n")
      });

      const usedModel = Boolean(gwOut && gwOut.usedModel === true);
      const executionMode = usedModel ? "LIVE_MODEL" : "FALLBACK_NO_MODEL";

      return {
        summary: gwOut && gwOut.output
          ? String(gwOut.output).slice(0, 240)
          : `Fallback defensive check completed for ${task.title}`,
        findings: [
          `task:${task.id}`,
          `mode:${executionMode}`,
          `model:${(gwOut && gwOut.model) || "none"}`
        ],
        modelTelemetry: {
          usedModel,
          executionMode,
          provider: gwOut && gwOut.provider ? gwOut.provider : "fallback",
          model: gwOut && gwOut.model ? gwOut.model : (preferredModel || "none"),
          latencyMs: gwOut && typeof gwOut.latencyMs === "number" ? gwOut.latencyMs : 0,
          fallbackReason: usedModel ? null : ((gwOut && gwOut.fallbackReason) || "NO_LIVE_MODEL")
        }
      };
    }
  });

  const durations = [];
  const liveLatencies = [];
  const fallbackLatencies = [];
  const fallbackReasons = {};
  let verifiedCount = 0;
  let liveModelTasks = 0;
  let fallbackTasks = 0;

  for (let i = 0; i < iterations; i++) {
    const t0 = process.hrtime.bigint();
    const res = await cp.executeDefensiveMission(
      `Guard telemetry and audit integrity cycle #${i + 1}`,
      { eventType: "BENCH_TELEMETRY_GUARD", tags: ["triage", "telemetry", "audit"] }
    );
    const dtMs = Number(process.hrtime.bigint() - t0) / 1e6;
    durations.push(dtMs);

    assert.strictEqual(res.mission.humanApproved, false, "humanApproved must default to false");
    assert.strictEqual(res.mission.metadata.automaticWeaponsRelease, false, "automaticWeaponsRelease must be false");
    if (res.verification && res.verification.verified) {
      verifiedCount += 1;
    }

    for (const t of res.mission.tasks) {
      const mt = t.result && t.result.output && t.result.output.modelTelemetry
        ? t.result.output.modelTelemetry
        : null;
      if (!mt) continue;
      if (mt.executionMode === "LIVE_MODEL") {
        liveModelTasks += 1;
        liveLatencies.push(Number(mt.latencyMs || 0));
      } else {
        fallbackTasks += 1;
        fallbackLatencies.push(Number(mt.latencyMs || 0));
        const reason = mt.fallbackReason || "NO_LIVE_MODEL";
        fallbackReasons[reason] = (fallbackReasons[reason] || 0) + 1;
      }
    }
  }

  const snapSave = cp.memory.saveSnapshot(snapDir, { versionedDirectory: true });
  assert.strictEqual(snapSave.ok, true, "Snapshot save must succeed");

  const recoveredPlane = new SecurityControlPlane({ seedDefaultPolicies: false });
  const snapRecover = recoveredPlane.memory.recoverFromDirectory(snapDir);
  assert.strictEqual(snapRecover.ok, true, "Snapshot recovery must succeed");
  assert.strictEqual(snapRecover.integrity.valid, true, "Recovered audit chain must be valid");

  const diag = buildControlPlaneDiagnostics(recoveredPlane, { snapshotDir: snapDir });
  assert.strictEqual(diag.auditIntegrity.valid, true, "Diagnostics auditIntegrity must be valid");
  assert.strictEqual(diag.safetyBoundaries.defaultHumanApproved, false);
  assert.strictEqual(diag.safetyBoundaries.automaticWeaponsRelease, false);

  const avg = (arr) => (arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)) : null);
  const totalMs = durations.reduce((a, b) => a + b, 0);

  const summary = {
    ok: true,
    iterations,
    modelTimeoutMs,
    timingMs: {
      total: Number(totalMs.toFixed(2)),
      avg: avg(durations),
      min: Number(Math.min(...durations).toFixed(2)),
      max: Number(Math.max(...durations).toFixed(2))
    },
    gatewayTelemetry: {
      liveModelTasks,
      fallbackTasks,
      avgLiveLatencyMs: avg(liveLatencies),
      avgFallbackLatencyMs: avg(fallbackLatencies),
      fallbackReasons
    },
    verification: {
      verifiedMissions: verifiedCount,
      totalMissions: iterations
    },
    safetyBoundaries: {
      defaultHumanApproved: diag.safetyBoundaries.defaultHumanApproved,
      automaticWeaponsRelease: diag.safetyBoundaries.automaticWeaponsRelease
    },
    auditIntegrity: {
      valid: diag.auditIntegrity.valid,
      auditCount: diag.auditIntegrity.count,
      recoveredFrom: path.basename(snapRecover.recoveredFrom)
    }
  };

  console.log("MARAUDER CORE BENCHMARK v1.1 PASS");
  console.log(JSON.stringify(summary, null, 2));

  try {
    fs.rmSync(snapDir, { recursive: true, force: true });
  } catch (_) {}

  return summary;
}

if (require.main === module) {
  runCoreBenchmark().catch((err) => {
    console.error("MARAUDER CORE BENCHMARK FAIL:", err && err.stack ? err.stack : err);
    process.exit(1);
  });
}

module.exports = { runCoreBenchmark };
