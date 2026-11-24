const fs = require("fs");
const path = require("path");
const os = require("os");
const RealityExecutor = require("../executor/reality-executor");

const ASSET_GRAPH_PATH = path.join(__dirname, "..", "..", "data", "assets", "asset-graph.json");

const COMPONENTS_12 = [
  "marauder-core",
  "agent-registry",
  "mission-orchestrator",
  "policy-engine",
  "local-agent",
  "executor",
  "asset-registry",
  "evidence-engine",
  "telemetry-engine",
  "security-lab",
  "report-engine",
  "owner-control"
];

class MarauderOSCore {
  constructor() {
    this.components = COMPONENTS_12;
    this.executor = new RealityExecutor();
    fs.mkdirSync(path.dirname(ASSET_GRAPH_PATH), { recursive: true });
  }

  getStatus() {
    return {
      os: "MARAUDER OS",
      mode: "LOCAL-FIRST / HYBRID",
      componentsCount: this.components.length,
      components: this.components,
      host: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        uptimeSec: Math.round(os.uptime())
      }
    };
  }

  async buildAssetGraph() {
    const graph = {
      updatedAt: new Date().toISOString(),
      nodes: {
        host: { name: os.hostname(), platform: os.platform(), release: os.release() },
        interfaces: Object.keys(os.networkInterfaces()),
        repositories: [],
        services: []
      }
    };

    const gitCheck = await this.executor.runSafeCheck({
      agent: "Asset Discovery Agent",
      capability: "filesystem.read",
      target: process.cwd(),
      bin: "git",
      args: ["remote", "-v"]
    });
    if (gitCheck.result === "VERIFIED") {
      graph.nodes.repositories.push({ path: process.cwd(), evidenceId: gitCheck.id, remotes: gitCheck.realOutput });
    }

    const nodeCheck = await this.executor.runSafeCheck({
      agent: "Service Inventory Agent",
      capability: "process.inspect",
      target: "node-runtime",
      bin: "node",
      args: ["-v"]
    });
    if (nodeCheck.result === "VERIFIED") {
      graph.nodes.services.push({ name: "node", version: nodeCheck.realOutput.trim(), evidenceId: nodeCheck.id });
    }

    fs.writeFileSync(ASSET_GRAPH_PATH, JSON.stringify(graph, null, 2));
    return graph;
  }

  async runDemoOperation(targetLabel = "verified-local-lab") {
    const graph = await this.buildAssetGraph();
    const diskOrProc = process.platform === "win32"
      ? await this.executor.runSafeCheck({
          agent: "Endpoint Detection Agent",
          capability: "process.inspect",
          target: targetLabel,
          bin: "cmd",
          args: ["/c", "whoami"]
        })
      : await this.executor.runSafeCheck({
          agent: "Endpoint Detection Agent",
          capability: "filesystem.read",
          target: targetLabel,
          bin: "uname",
          args: ["-a"]
        });

    const deniedTest = await this.executor.runSafeCheck({
      agent: "Policy Engine",
      capability: "root.unrestricted",
      target: targetLabel,
      bin: "echo",
      args: ["should-not-run"]
    });

    const evidences = [graph && "asset-graph-saved", diskOrProc, deniedTest].filter(Boolean);
    return {
      operation: "MARAUDER LIVE OPERATION (DEMO MODE)",
      target: targetLabel,
      objective: "security assessment with real evidence & least-privilege enforcement",
      stages: [
        "DISCOVER (asset graph)",
        "ASSESS (runtime/config check)",
        "VALIDATE (capability gate)",
        "VERIFY (evidence logged)"
      ],
      evidenceIds: [diskOrProc.id, deniedTest.id],
      checks: [diskOrProc, deniedTest],
      summary: {
        verifiedChecks: [diskOrProc, deniedTest].filter((x) => x.result === "VERIFIED").length,
        blockedUnauthorized: [diskOrProc, deniedTest].filter((x) => x.result === "DENIED").length
      }
    };
  }
}

module.exports = MarauderOSCore;
