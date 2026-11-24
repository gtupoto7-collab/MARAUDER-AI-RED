const fs = require("fs");
const path = require("path");
const express = require("express");
const MarauderOSCore = require("../core/marauder-core/os-core");
const EvidenceStore = require("../core/evidence-engine/evidence-store");
const MarauderSwarmEngine = require("../core/mission-orchestrator/swarm-engine");
const MarauderFabricEngine = require("../core/fabric/marauder-fabric");
const MarauderBenchmark = require("../modules/marauder-benchmark");
const ReadOnlyVerticalSlice = require("../modules/vertical-slice");
const MissionOrchestrator = require("../modules/mission-orchestrator");
const Upgrade1000Engine = require("../modules/upgrade-1000-engine");

const GRAPH_FILE = path.join(__dirname, "..", "data", "assets", "marauder-graph.json");

const router = express.Router();
const osCore = new MarauderOSCore();
const evidence = new EvidenceStore();
const swarm = new MarauderSwarmEngine();
const fabric = new MarauderFabricEngine();
const benchmark = new MarauderBenchmark();
const verticalSlice = new ReadOnlyVerticalSlice(process.cwd());
const orchestrator = new MissionOrchestrator(process.cwd());
const upgrade1000 = new Upgrade1000Engine();

router.get("/status", (req, res) => {
  res.json(osCore.getStatus());
});

router.post("/asset-graph", async (req, res) => {
  try {
    const graph = await osCore.buildAssetGraph();
    res.json({ ok: true, graph });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/demo-run", async (req, res) => {
  try {
    const target = (req.body && req.body.target) || "verified-local-lab";
    const report = await osCore.runDemoOperation(target);
    res.json({ ok: true, report });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/evidence", (req, res) => {
  res.json({ ok: true, items: evidence.listRecent(req.query.limit || 20) });
});

router.post("/swarm", async (req, res) => {
  try {
    const { mission, target } = req.body || {};
    if (!mission || !String(mission).trim()) {
      return res.status(400).json({ ok: false, error: "mission is required" });
    }
    const result = await swarm.runMission({ mission, target: target || "verified-local-lab" });
    res.status(result.ok ? 200 : 403).json(result);
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

router.get("/graph", (req, res) => {
  if (!fs.existsSync(GRAPH_FILE)) return res.json({ ok: true, graph: { nodes: {} } });
  res.json({ ok: true, graph: JSON.parse(fs.readFileSync(GRAPH_FILE, "utf8")) });
});

router.get("/fabric/stats", (req, res) => {
  res.json({ ok: true, stats: fabric.getStats() });
});

router.post("/fabric/mission", async (req, res) => {
  try {
    const { mission, target, events } = req.body || {};
    if (!mission) return res.status(400).json({ ok: false, error: "mission is required" });
    const out = await fabric.runBlackBoxMission({ mission, target, events });
    res.status(out.ok ? 200 : 403).json(out);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/fabric/asset", (req, res) => {
  const out = fabric.upsertAsset(req.body || {});
  res.status(out.ok ? 200 : 400).json(out);
});

router.get("/benchmark", (req, res) => {
  const result = benchmark.run();
  res.json({ ok: true, ...result });
});

router.post("/slice", async (req, res) => {
  try {
    const { targetScope, objective } = req.body || {};
    const result = await verticalSlice.executeSlice({
      targetScope: targetScope || "verified-local-lab",
      objective: objective || "Read-only dependency-audit and local-listeners check"
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/orchestrate", async (req, res) => {
  try {
    const { objective, targetScope } = req.body || {};
    const out = await orchestrator.runMission({
      objective: objective || "Assess my infrastructure",
      targetScope: targetScope || "verified-local-lab"
    });
    res.status(out.ok ? 200 : 403).json(out);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/upgrade-1000", (req, res) => {
  try {
    const { claims, locale, preferLocal, events, coveredAreas, artifactPath, labIsolated } = req.body || {};
    const ai = upgrade1000.evaluateAgentIntelligence({ claims, locale, preferLocal });
    const hunting = upgrade1000.runDetectionAndHunting({ events, coveredAreas });
    const lab = artifactPath ? upgrade1000.inspectLabArtifact({ filePath: artifactPath, labIsolated: labIsolated !== false }) : null;
    res.json({ ok: true, ai, hunting, lab });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.post("/platform-suite", (req, res) => {
  try {
    const { scenario, chainRecords, events, assetsCount, openGaps } = req.body || {};
    const out = platformSuite.runSimulationAndRegression({ scenario, chainRecords, events, assetsCount, openGaps });
    res.json({ ok: true, out });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.post("/intelligence-loop", (req, res) => {
  try {
    const out = intelligenceLoop.runCycle(req.body || {});
    res.json({ ok: true, cycle: out });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.get("/summary", (req, res) => {
  res.json({
    ok: true,
    os: osCore.getStatus(),
    fabric: fabric.getStats(),
    loop: {
      profile: intelligenceLoop.profile,
      cycleCount: intelligenceLoop.state.cycleCount,
      baselineThresholdScore: intelligenceLoop.state.baselineThresholdScore,
      pendingPolicyApprovals: intelligenceLoop.state.pendingPolicyApprovals.length
    },
    recentEvidence: evidence.listRecent(10),
    benchmark: benchmark.run().report.metrics
  });
});

router.post("/analyze-project", async (req, res) => {
  try {
    const { prompt, targetDir } = req.body || {};
    const out = await projectAnalyzer80.analyzeProject({
      prompt: prompt || "MARAUDER, анализирай сигурността на моя проект.",
      targetDir: targetDir || process.cwd()
    });
    res.json(out);
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.post("/plan-mission", (req, res) => {
  try {
    const { prompt, scope, policyApproved } = req.body || {};
    const out = missionPlanner.planFromNaturalLanguage(prompt || "MARAUDER, провери сигурността на моя проект.", { scope, policyApproved: policyApproved !== false });
    res.status(out.ok ? 200 : 403).json(out);
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

module.exports = router;
