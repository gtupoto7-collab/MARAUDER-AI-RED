const crypto = require("crypto");
const { sha256 } = require("./black-box-parliament");

const ALLOWED_MODES = new Set([
  "read-only",
  "local-only",
  "lab-only",
  "maintenance",
  "emergency",
  "approval",
  "simulation",
  "replay",
  "benchmark",
  "test"
]);

class ExecutionReliabilityEngine {
  constructor({ mode = "read-only", maxRetries = 2, circuitThreshold = 3 } = {}) {
    this.mode = ALLOWED_MODES.has(mode) ? mode : "read-only";
    this.maxRetries = maxRetries;
    this.circuitThreshold = circuitThreshold;
    this.consecutiveFailures = 0;
    this.circuitOpen = false;
    this.queue = [];
    this.deadLetterQueue = [];
    this.quarantinedAgents = new Set();
    this.jitLeases = new Map();
    this.auditLog = [];
  }

  setMode(nextMode, reason = "operator-update") {
    if (!ALLOWED_MODES.has(nextMode)) {
      throw new Error(`UNSUPPORTED_RUNTIME_MODE:${nextMode}`);
    }
    const prev = this.mode;
    this.mode = nextMode;
    this._audit("MODE_CHANGE", { from: prev, to: nextMode, reason });
    return { previousMode: prev, currentMode: this.mode };
  }

  issueJitCapability({ agentId, capability, targetScope, ttlMs = 60000 }) {
    if (this.quarantinedAgents.has(agentId)) {
      return { granted: false, reason: "AGENT_QUARANTINED" };
    }
    const tokenId = `JIT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const expiresAt = Date.now() + Number(ttlMs || 60000);
    const lease = { tokenId, agentId, capability, targetScope, expiresAt, revoked: false };
    this.jitLeases.set(tokenId, lease);
    this._audit("JIT_GRANTED", lease);
    return { granted: true, lease };
  }

  revokeJitCapability(tokenId, reason = "revoked") {
    const lease = this.jitLeases.get(tokenId);
    if (!lease) return { revoked: false, reason: "NOT_FOUND" };
    lease.revoked = true;
    this._audit("JIT_REVOKED", { tokenId, reason });
    return { revoked: true, tokenId };
  }

  quarantineAgent(agentId, reason = "health-check-failed") {
    this.quarantinedAgents.add(agentId);
    this._audit("AGENT_QUARANTINED", { agentId, reason });
    return { agentId, quarantined: true, totalQuarantined: this.quarantinedAgents.size };
  }

  enqueueJob(job) {
    const id = job.id || `JOB-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const item = { id, status: "QUEUED", attempts: 0, enqueuedAt: new Date().toISOString(), ...job };
    this.queue.push(item);
    return item;
  }

  async processNextJob(workerFn) {
    if (this.circuitOpen) {
      return { ok: false, status: "CIRCUIT_OPEN", deadLetterCount: this.deadLetterQueue.length };
    }
    const job = this.queue.shift();
    if (!job) return { ok: false, status: "QUEUE_EMPTY" };

    while (job.attempts <= this.maxRetries) {
      job.attempts += 1;
      try {
        const output = await workerFn(job);
        this.consecutiveFailures = 0;
        const receiptHash = sha256({ jobId: job.id, attempt: job.attempts, output });
        const receipt = {
          jobId: job.id,
          status: "COMPLETED",
          attempts: job.attempts,
          mode: this.mode,
          receiptHash,
          completedAt: new Date().toISOString()
        };
        this._audit("JOB_COMPLETED", receipt);
        return { ok: true, job, output, receipt };
      } catch (err) {
        this.consecutiveFailures += 1;
        if (this.consecutiveFailures >= this.circuitThreshold) {
          this.circuitOpen = true;
          this._audit("CIRCUIT_OPENED", { failures: this.consecutiveFailures, jobId: job.id });
        }
        if (job.attempts > this.maxRetries) {
          job.status = "DEAD_LETTER";
          job.error = err.message;
          this.deadLetterQueue.push(job);
          this._audit("JOB_DLQ", { jobId: job.id, error: err.message });
          return { ok: false, status: "DEAD_LETTER", job };
        }
        const backoffMs = Math.min(200, 25 * Math.pow(2, job.attempts - 1));
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }

  // Reality Engine 2.0: CLAIM -> OBSERVATION -> RAW EVIDENCE -> HASH -> INDEPENDENT CHECK -> SECONDARY VERIFICATION -> FINDING
  realityEngineV2({ claim, observation, rawEvidence, independentCheckPassed = true, secondaryVerified = true }) {
    const evidenceHash = sha256({ observation, rawEvidence });
    const verified = Boolean(
      claim &&
      observation &&
      rawEvidence &&
      independentCheckPassed === true &&
      secondaryVerified === true
    );

    if (!verified) {
      return {
        stage: "REJECTED_UNVERIFIED",
        findingAllowed: false,
        reason: "Requires claim, observation, raw evidence, independent check, and secondary verification",
        evidenceHash
      };
    }

    const findingId = `FND-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    return {
      stage: "CONFIRMED_FINDING",
      findingAllowed: true,
      finding: {
        id: findingId,
        claim,
        observation,
        evidenceHash,
        pipeline: ["CLAIM", "OBSERVATION", "RAW_EVIDENCE", "HASH", "INDEPENDENT_CHECK", "SECONDARY_VERIFICATION", "FINDING"],
        verifiedAt: new Date().toISOString()
      }
    };
  }

  _audit(event, detail) {
    this.auditLog.push({ ts: new Date().toISOString(), event, detail });
  }
}

module.exports = ExecutionReliabilityEngine;
