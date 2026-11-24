const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { sha256 } = require("./black-box-parliament");

const LAB_DIR = path.join(__dirname, "..", "data", "lab-samples");
const OUT_DIR = path.join(__dirname, "..", "data", "upgrade-1000");

function calcEntropy(buf) {
  if (!buf || buf.length === 0) return 0;
  const freq = new Array(256).fill(0);
  for (const b of buf) freq[b]++;
  let ent = 0;
  for (const c of freq) {
    if (c === 0) continue;
    const p = c / buf.length;
    ent -= p * Math.log2(p);
  }
  return Number(ent.toFixed(4));
}

class Upgrade1000Engine {
  constructor() {
    fs.mkdirSync(LAB_DIR, { recursive: true });
    fs.mkdirSync(OUT_DIR, { recursive: true });
    this.tracks = {
      aiIntelligence: 100,
      detectionThreatHunting: 100,
      malwareDfirLab: 100
    };
  }

  // 1. AI / Agent Intelligence: routing, schema validation, consensus & contradiction check, BG/EN summary
  evaluateAgentIntelligence({ claims = [], locale = "bg", preferLocal = true }) {
    const cleanClaims = Array.isArray(claims) ? claims.filter((c) => c && typeof c.claim === "string") : [];
    const hasEvidenceCount = cleanClaims.filter((c) => Boolean(c.hasEvidence)).length;
    const contradictions = [];

    for (let i = 0; i < cleanClaims.length; i++) {
      for (let j = i + 1; j < cleanClaims.length; j++) {
        const a = cleanClaims[i].claim.toLowerCase();
        const b = cleanClaims[j].claim.toLowerCase();
        const negA = /\b(no|not|none|safe|false|няма|не е)\b/.test(a);
        const negB = /\b(no|not|none|safe|false|няма|не е)\b/.test(b);
        if (negA !== negB && cleanClaims[i].topic && cleanClaims[i].topic === cleanClaims[j].topic) {
          contradictions.push({ pair: [i, j], topic: cleanClaims[i].topic });
        }
      }
    }

    const consensusRatio =
      cleanClaims.length > 0 ? Number((hasEvidenceCount / cleanClaims.length).toFixed(2)) : 0;
    const calibratedConfidence = Number(
      Math.max(0, Math.min(1, consensusRatio - contradictions.length * 0.2)).toFixed(2)
    );

    const summary =
      locale === "en"
        ? `Claims: ${cleanClaims.length}, Evidence-backed: ${hasEvidenceCount}, Contradictions: ${contradictions.length}, Confidence: ${calibratedConfidence}`
        : `Твърдения: ${cleanClaims.length}, С доказателства: ${hasEvidenceCount}, Противоречия: ${contradictions.length}, Увереност: ${calibratedConfidence}`;

    return {
      track: "AI_AGENT_INTELLIGENCE",
      routing: {
        modelTarget: preferLocal ? "ollama:llama3.2" : "cloud-fallback",
        circuitBreaker: contradictions.length > 2 ? "OPEN_REVIEW" : "CLOSED_HEALTHY"
      },
      validation: {
        schemaValid: cleanClaims.every((c) => typeof c.claim === "string" && c.claim.trim().length > 0),
        contradictions,
        consensusRatio,
        calibratedConfidence
      },
      summary
    };
  }

  // 2. Detection / Threat Hunting: anomaly scoring, correlation, hunt workflow & coverage gaps
  runDetectionAndHunting({ events = [], coveredAreas = [] }) {
    const allAreas = ["endpoint", "network", "identity", "cloud", "api", "dns", "dependencies"];
    const coveredSet = new Set(coveredAreas.map((x) => String(x).toLowerCase()));
    const coverageGaps = allAreas.filter((a) => !coveredSet.has(a));

    const enriched = (Array.isArray(events) ? events : []).map((ev, idx) => {
      const msg = String(ev.message || "");
      const highSignal = /fail|denied|anom|suspicious|unauth|escalat|brute|beaconing/i.test(msg);
      const sevWeight = { low: 15, medium: 45, high: 75, critical: 95 }[String(ev.severity || "low").toLowerCase()] || 20;
      const anomalyScore = Math.min(100, sevWeight + (highSignal ? 15 : 0));
      return {
        id: `DET-${idx + 1}`,
        asset: ev.asset || "local-host",
        category: ev.category || "general",
        anomalyScore,
        triageBucket: anomalyScore >= 75 ? "ESCALATE" : anomalyScore >= 45 ? "INVESTIGATE" : "SUPPRESS_OR_BASELINE",
        digest: sha256(ev).slice(0, 12)
      };
    });

    return {
      track: "DETECTION_THREAT_HUNTING",
      huntWorkflow: ["HUNT_TEMPLATE", "CORRELATE", "SCORE", "TRIAGE", "EVIDENCE_CHECK", "REPORT"],
      totalEvaluated: enriched.length,
      escalations: enriched.filter((e) => e.triageBucket === "ESCALATE").length,
      coveragePct: Number((((allAreas.length - coverageGaps.length) / allAreas.length) * 100).toFixed(1)),
      coverageGaps,
      events: enriched
    };
  }

  // 3. Malware / DFIR Laboratory: isolated sample metadata, hashing, entropy & chain-of-custody
  inspectLabArtifact({ filePath, labIsolated = true }) {
    if (!labIsolated) {
      throw new Error("MALWARE_DFIR_REQUIRES_ISOLATED_LAB");
    }
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      throw new Error("ARTIFACT_FILE_NOT_FOUND");
    }

    const buf = fs.readFileSync(resolved);
    const sha = crypto.createHash("sha256").update(buf).digest("hex");
    const md5 = crypto.createHash("md5").update(buf).digest("hex");
    const entropy = calcEntropy(buf);
    const isElf = buf.length >= 4 && buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46;
    const isPe = buf.length >= 2 && buf[0] === 0x4d && buf[1] === 0x5a;
    const isZip = buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b;

    const format = isElf ? "ELF" : isPe ? "PE/MZ" : isZip ? "ZIP/ARCHIVE" : "TEXT_OR_BINARY";
    const highEntropyOrPacked = entropy >= 7.2;

    const custodyRecord = {
      experimentId: `LAB-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      isolated: true,
      sandboxPolicy: "NO_PRODUCTION_MUTATION_AUTO_RESET",
      artifactName: path.basename(resolved),
      sizeBytes: buf.length,
      format,
      entropy,
      highEntropyOrPacked,
      hashes: { sha256: sha, md5 },
      chainOfCustodyHash: sha256({ sha, entropy, format, ts: Date.now() }),
      analyzedAt: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(OUT_DIR, `${custodyRecord.experimentId}.json`),
      JSON.stringify(custodyRecord, null, 2)
    );

    return {
      track: "MALWARE_DFIR_LAB",
      custodyRecord
    };
  }
}

module.exports = Upgrade1000Engine;
