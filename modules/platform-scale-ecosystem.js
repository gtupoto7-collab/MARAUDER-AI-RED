const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { sha256 } = require("./black-box-parliament");

const OUT_DIR = path.join(__dirname, "..", "data", "platform-suite");

class EvidenceVerifier {
  validateChain(records = []) {
    let prevHash = "GENESIS";
    let lastTsMs = 0;
    const issues = [];

    records.forEach((rec, idx) => {
      if (rec.prevHash !== prevHash) {
        issues.push({ idx, code: "BROKEN_HASH_CHAIN", expected: prevHash, actual: rec.prevHash });
      }
      const tsMs = Date.parse(rec.ts || "");
      if (Number.isNaN(tsMs)) {
        issues.push({ idx, code: "INVALID_TIMESTAMP" });
      } else {
        if (tsMs < lastTsMs) {
          issues.push({ idx, code: "NON_MONOTONIC_TIMESTAMP", ts: rec.ts });
        }
        lastTsMs = tsMs;
      }
      if (rec.hash) {
        const { hash, ...rest } = rec;
        if (sha256(rest) !== hash) {
          issues.push({ idx, code: "TAMPERED_RECORD_HASH" });
        }
      }
      prevHash = rec.hash || sha256(rec);
    });

    const total = records.length;
    const validCount = total - issues.length;
    const qualityScore = total > 0 ? Math.max(0, Math.round((validCount / total) * 100)) : 100;

    return {
      valid: issues.length === 0,
      totalRecords: total,
      monotonicChronology: !issues.some((i) => i.code === "NON_MONOTONIC_TIMESTAMP"),
      scores: {
        evidenceQualityScore: qualityScore,
        evidenceCompletenessScore: total > 0 ? 100 : 0,
        evidenceReliabilityScore: issues.length === 0 && total > 0 ? 95 : 50
      },
      issues
    };
  }

  verifyRemediation({ findingId, beforeState, afterState, verifiedBy = "verifier-agent" }) {
    const beforeHash = sha256(beforeState || {});
    const afterHash = sha256(afterState || {});
    const changed = beforeHash !== afterHash;
    return {
      findingId,
      remediated: changed,
      beforeHash,
      afterHash,
      verifiedBy,
      verifiedAt: new Date().toISOString(),
      proofDigest: sha256({ findingId, beforeHash, afterHash, verifiedBy })
    };
  }
}

class HighVolumeEventBus {
  constructor({ partitions = 8, maxQueueDepth = 5000 } = {}) {
    this.partitions = partitions;
    this.maxQueueDepth = maxQueueDepth;
    this.queues = Array.from({ length: partitions }, () => []);
    this.dlq = [];
    this.metrics = { ingested: 0, accepted: 0, droppedBackpressure: 0, malformed: 0, duplicates: 0 };
    this._seen = new Set();
  }

  partitionFor(key = "default") {
    const h = crypto.createHash("md5").update(String(key)).digest();
    return h[0] % this.partitions;
  }

  ingestBatch(events = [], { ttlSec = 86400 } = {}) {
    const started = Date.now();
    const acceptedItems = [];

    for (const ev of Array.isArray(events) ? events : []) {
      this.metrics.ingested += 1;
      if (!ev || typeof ev !== "object" || !ev.message) {
        this.metrics.malformed += 1;
        this.dlq.push({ reason: "MALFORMED_EVENT", ev, ts: new Date().toISOString() });
        continue;
      }

      const pIdx = this.partitionFor(ev.asset || ev.source || "global");
      if (this.queues[pIdx].length >= this.maxQueueDepth) {
        this.metrics.droppedBackpressure += 1;
        this.dlq.push({ reason: "BACKPRESSURE_LIMIT", partition: pIdx, ev, ts: new Date().toISOString() });
        continue;
      }

      const dedupKey = sha256({ a: ev.asset || "", s: ev.source || "", m: ev.message });
      if (this._seen.has(dedupKey)) {
        this.metrics.duplicates += 1;
        continue;
      }
      this._seen.add(dedupKey);

      const envelope = {
        id: `EVT-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
        partition: pIdx,
        ttlSec,
        tier: ["high", "critical"].includes(String(ev.severity || "").toLowerCase()) ? "HOT" : "WARM",
        eventHash: dedupKey,
        ingestedAt: new Date().toISOString(),
        payload: ev
      };
      this.queues[pIdx].push(envelope);
      this.metrics.accepted += 1;
      acceptedItems.push(envelope);
    }

    const elapsedMs = Date.now() - started;
    return {
      acceptedCount: acceptedItems.length,
      latencyMs: elapsedMs,
      throughputEventsPerSec: elapsedMs > 0 ? Math.round((acceptedItems.length / elapsedMs) * 1000) : acceptedItems.length,
      queueDepths: this.queues.map((q) => q.length),
      dlqCount: this.dlq.length,
      metrics: { ...this.metrics }
    };
  }
}

class ConnectorRegistry {
  constructor() {
    this.connectors = new Map();
    const defaults = [
      { id: "git-local", category: "scm", mode: "read-only", scopes: ["repo:read"], health: "healthy" },
      { id: "docker-local", category: "containers", mode: "read-only", scopes: ["containers:inspect"], health: "healthy" },
      { id: "ollama-local", category: "model-gateway", mode: "local-only", scopes: ["llm:infer"], health: "healthy" },
      { id: "cve-feed", category: "threat-intel", mode: "read-only", scopes: ["advisories:read"], health: "healthy" }
    ];
    for (const c of defaults) this.register(c);
  }

  register(conn) {
    if (!conn || !conn.id) throw new Error("CONNECTOR_ID_REQUIRED");
    const entry = {
      id: conn.id,
      category: conn.category || "general",
      mode: conn.mode || "read-only",
      scopes: Array.isArray(conn.scopes) ? conn.scopes : ["read"],
      health: conn.health || "healthy",
      version: conn.version || "1.0.0",
      updatedAt: new Date().toISOString()
    };
    this.connectors.set(entry.id, entry);
    return entry;
  }

  list() {
    return Array.from(this.connectors.values());
  }
}

class AutonomousPlatformSuite {
  constructor() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    this.evidenceVerifier = new EvidenceVerifier();
    this.eventBus = new HighVolumeEventBus({ partitions: 8, maxQueueDepth: 5000 });
    this.connectors = new ConnectorRegistry();
    this.centers = [
      "Mission Center",
      "SOC Center",
      "Asset Center",
      "Threat Center",
      "Evidence Center",
      "Agent Center",
      "Lab Center",
      "Risk Center",
      "Compliance Center",
      "Research Center"
    ];
  }

  computeScores({ assetsCount = 0, verifiedFindings = 0, openGaps = 0, chainValid = true }) {
    const evidenceScore = chainValid ? (verifiedFindings > 0 ? 92 : 75) : 30;
    const riskScore = Math.min(100, openGaps * 15 + (verifiedFindings > 0 ? 20 : 0));
    const securityScore = Math.max(0, Math.min(100, 100 - Math.round(riskScore * 0.6) + (assetsCount > 0 ? 5 : 0)));
    const resilienceScore = chainValid && openGaps === 0 ? 90 : Math.max(40, 85 - openGaps * 10);

    return {
      securityScore,
      riskScore,
      exposureScore: Math.min(100, openGaps * 20),
      resilienceScore,
      evidenceScore,
      maturityScore: Math.round((securityScore + resilienceScore + evidenceScore) / 3)
    };
  }

  runSimulationAndRegression({ scenario = "baseline-read-only-check", chainRecords = [], events = [], assetsCount = 1, openGaps = 0 }) {
    const chainCheck = this.evidenceVerifier.validateChain(chainRecords);
    const busStats = this.eventBus.ingestBatch(events);
    const scores = this.computeScores({
      assetsCount,
      verifiedFindings: chainCheck.valid ? 1 : 0,
      openGaps,
      chainValid: chainCheck.valid
    });

    const runBundle = {
      runId: `SIM-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      scenario,
      executedAt: new Date().toISOString(),
      centers: this.centers,
      connectorsCount: this.connectors.list().length,
      chainCheck,
      busStats,
      scores,
      regressionPassed: chainCheck.valid && busStats.dlqCount === 0
    };

    fs.writeFileSync(path.join(OUT_DIR, `${runBundle.runId}.json`), JSON.stringify(runBundle, null, 2));
    return runBundle;
  }
}

module.exports = {
  EvidenceVerifier,
  HighVolumeEventBus,
  ConnectorRegistry,
  AutonomousPlatformSuite
};
