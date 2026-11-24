const assert = require("assert");
const { MarauderPipelineV2 } = require("../modules/marauder-core-v2");

(async () => {
  const pipeline = new MarauderPipelineV2(process.cwd());
  const out = await pipeline.runSafeMission({
    objective: "Smoke test full safe pipeline",
    targetScope: "verified-local-lab"
  });

  const { report } = out;
  assert.ok(/^MAR-2026-[A-F0-9]{8}$/.test(report.missionId), "Invalid missionId format");
  assert.ok(/^CORR-[A-F0-9]{12}$/.test(report.correlationId), "Invalid correlationId format");
  assert.strictEqual(report.state, "COMPLETED", "Mission did not reach COMPLETED");
  assert.strictEqual(report.metrics.verifiedFindings, 1, "Missing verified finding");
  assert.strictEqual(report.metrics.errors, 0, "Unexpected errors in smoke test");
  assert.ok(report.blackBoxHeadHash && report.blackBoxHeadHash.length === 64, "Missing BlackBox SHA-256 hash");

  console.log(
    `SMOKE PASS | ${report.missionId} | ${report.correlationId} | state=${report.state} | health=${report.agentSnapshot.health} | ${report.metrics.duration}ms`
  );
  process.exit(0);
})().catch((err) => {
  console.error("SMOKE FAILED:", err.message);
  process.exit(1);
});
