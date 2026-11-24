const crypto = require("crypto");

class LocalConnectorBridge {
  constructor({
    sharedSecret = process.env.MARAUDER_CONNECTOR_SECRET || "dev-local-connector-secret",
    allowedTargets = ["local-wsl", "approved-lab", "owned-lab"]
  } = {}) {
    this.sharedSecret = String(sharedSecret);
    this.allowedTargets = new Set(allowedTargets.map(String));
    this.usedNonces = new Map();
  }

  signMissionEnvelope(missionPayload, nonce = crypto.randomBytes(8).toString("hex")) {
    const envelope = {
      missionId: String(missionPayload.missionId || ""),
      targetScope: String(missionPayload.targetScope || ""),
      checkName: String(missionPayload.checkName || ""),
      nonce: String(nonce),
      ts: Date.now()
    };
    const sig = crypto
      .createHmac("sha256", this.sharedSecret)
      .update(JSON.stringify(envelope))
      .digest("hex");
    return { envelope, sig };
  }

  verifyEnvelope(envelope, sig, maxAgeMs = 60000) {
    if (!envelope || !sig || !envelope.nonce || !envelope.ts) {
      return { ok: false, reason: "MISSING_ENVELOPE_FIELDS" };
    }
    const age = Math.abs(Date.now() - Number(envelope.ts));
    if (age > maxAgeMs) {
      return { ok: false, reason: "ENVELOPE_EXPIRED" };
    }
    if (this.usedNonces.has(envelope.nonce)) {
      return { ok: false, reason: "REPLAY_NONCE_REJECTED" };
    }

    const expected = crypto
      .createHmac("sha256", this.sharedSecret)
      .update(JSON.stringify({
        missionId: String(envelope.missionId || ""),
        targetScope: String(envelope.targetScope || ""),
        checkName: String(envelope.checkName || ""),
        nonce: String(envelope.nonce),
        ts: Number(envelope.ts)
      }))
      .digest("hex");

    const sigBuf = Buffer.from(String(sig), "utf8");
    const expBuf = Buffer.from(expected, "utf8");
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return { ok: false, reason: "INVALID_SIGNATURE" };
    }

    this.usedNonces.set(envelope.nonce, Date.now());
    return { ok: true };
  }

  async dispatchToCore({ envelope, sig, executeAllowedCheck }) {
    const auth = this.verifyEnvelope(envelope, sig);
    if (!auth.ok) {
      return { ok: false, stage: "AUTH_FAILED", error: auth.reason };
    }

    if (!this.allowedTargets.has(String(envelope.targetScope || ""))) {
      return {
        ok: false,
        stage: "SCOPE_BLOCKED",
        error: `Целта '${envelope.targetScope}' не е разрешена в локалния MARAUDER CORE.`
      };
    }

    if (typeof executeAllowedCheck !== "function") {
      return { ok: false, stage: "NO_EXECUTOR", error: "Липсва локален executor в CORE." };
    }

    const executionResult = await executeAllowedCheck(envelope);
    return {
      ok: true,
      stage: "CORE_EXECUTED",
      missionId: envelope.missionId,
      targetScope: envelope.targetScope,
      executionResult
    };
  }
}

module.exports = { LocalConnectorBridge };
