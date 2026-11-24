const fs = require("fs");
const path = require("path");

const sections = {
  "Core / Orchestration": [
    "Mission UUID", "Correlation ID", "Idempotency key", "Mission state machine", "Priority queue",
    "Agent registry", "Capability registry", "Agent versioning", "Agent health score", "Agent heartbeat",
    "Agent timeout", "Agent retry policy", "Agent circuit breaker", "Agent quarantine", "Agent recovery",
    "Mission cancellation", "Mission pause/resume", "Mission checkpointing", "Mission replay", "Mission dependency graph"
  ],
  "Security / Access": [
    "Least-privilege capabilities", "JIT capability grants", "Automatic capability expiry", "Capability revocation", "Scope validation",
    "Target ownership validation", "Environment validation", "Read-only default", "Explicit action approval", "Dual approval for sensitive actions",
    "Policy versioning", "Policy simulation", "Policy regression tests", "Policy conflict detection", "Emergency kill switch",
    "Global maintenance lock", "Agent isolation", "Plugin isolation", "Connector isolation", "Secret isolation"
  ],
  "Evidence / Reality Engine": [
    "Universal evidence schema", "Evidence UUID", "Evidence hash", "Hash chain", "Evidence provenance",
    "Evidence timestamps", "Evidence freshness", "Evidence expiration", "Evidence deduplication", "Evidence quality score",
    "Evidence confidence", "Evidence source reliability", "Evidence contradiction detection", "Independent verification", "Cross-tool verification",
    "Finding verification", "Claim/evidence matching", "Unsupported-claim detection", "Tamper detection", "Evidence replay"
  ],
  "AssetGraph": [
    "Asset UUID", "Asset ownership", "Asset lifecycle", "Asset criticality", "Asset tagging",
    "Asset dependencies", "Service relationships", "Repository relationships", "Identity relationships", "Vulnerability relationships",
    "Threat relationships", "Finding relationships", "Graph snapshots", "Graph diff", "Graph search",
    "Graph anomaly detection", "Exposure scoring", "Blast-radius estimation", "Attack-path visualization", "Remediation-path visualization"
  ],
  "Event / Scale": [
    "Event schema validation", "Event deduplication", "Event normalization", "Event correlation", "Hot buffer",
    "Warm buffer", "Cold archive", "Event prioritization", "Backpressure", "Dead-letter queue",
    "Event replay", "Event retention", "Event compression", "Event partitioning", "Event indexing",
    "Event integrity checking", "Queue health monitoring", "Processing-latency metrics", "Throughput metrics", "Automatic load-shedding"
  ]
};

const items = [];
let idx = 1;
for (const [section, list] of Object.entries(sections)) {
  for (const title of list) {
    items.push({
      id: "BLK-" + String(idx).padStart(3, "0"),
      section,
      title,
      dod: {
        code: false,
        unitTest: false,
        integrationTest: false,
        smokeTest: false,
        blackboxEvent: false,
        evidence: false,
        verification: false
      },
      status: "BACKLOG"
    });
    idx += 1;
  }
}

const outPath = path.join(__dirname, "..", "data", "backlog-100.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ total: items.length, items }, null, 2));
console.log("Generated " + items.length + " backlog items -> " + outPath);
