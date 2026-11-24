const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length === 0 || ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

class MarauderRootController {
  constructor(options = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.secretKey =
      options.secretKey ||
      process.env.MARAUDER_ROOT_SECRET ||
      sha256(`marauder-root-v1:${this.rootDir}`);

    this.ledgerPath =
      options.ledgerPath ||
      path.join(this.rootDir, "data", "real-execution", "blackbox-ledger.jsonl");

    this.agentsCatalogPath =
      options.agentsCatalogPath ||
      path.join(this.rootDir, "data", "agent-army", "agents.json");

    this.killSwitchActive = Boolean(options.killSwitchActive || false);
    this.maxClockSkewMs = options.maxClockSkewMs || 5000;
    this.usedNonces = new Map();
    this.approvals = new Map();
    this.registryById = new Map();

    // По подразбиране режимът за повишени права е ИЗКЛЮЧЕН — активира се само по изрична команда на собственика
    this.privilegedGrant = {
      active: false,
      agentIds: new Set(),
      grantedAt: null,
      expiresAt: null,
      reason: null
    };

    // Default-deny capability, mode & scope матрица
    this.policy = options.policy || {
      "catalog:read": {
        modes: ["DEFENSE", "RED_TEAM", "COMMAND"],
        roles: [
          "Intelligence",
          "Code Security",
          "Verification",
          "SOC Division",
          "Integrity & Audit",
          "Cyber Defense",
          "AI Research",
          "Cloud Security",
          "Network Intelligence",
          "Malware Lab",
          "Offensive Security"
        ],
        allowedScopes: ["catalog:agents", "project:metadata", "lab:isolated"],
        requiresApproval: false,
        requiresPrivilegedGrant: false
      },
      "audit:file-hash": {
        modes: ["DEFENSE", "COMMAND"],
        roles: ["Verification", "Integrity & Audit", "Code Security", "SOC Division"],
        allowedScopes: ["project:files", "sandbox:artifacts"],
        requiresApproval: false,
        requiresPrivilegedGrant: false
      },
      "llm:local-analyze": {
        modes: ["DEFENSE", "RED_TEAM", "COMMAND"],
        roles: [
          "Intelligence",
          "Code Security",
          "Verification",
          "SOC Division",
          "Cyber Defense",
          "AI Research",
          "Network Intelligence",
          "Cloud Security",
          "Malware Lab",
          "Offensive Security"
        ],
        allowedScopes: ["local:ollama", "sandbox:logs", "lab:isolated"],
        requiresApproval: false,
        requiresPrivilegedGrant: false
      },
      "range:sim-validate": {
        modes: ["RED_TEAM"],
        roles: ["Offensive Security", "Code Security", "SOC Division", "Cyber Defense"],
        allowedScopes: ["lab:isolated", "range:authorized"],
        requiresApproval: true,
        requiresPrivilegedGrant: false
      },
      "sandbox:exec": {
        modes: ["DEFENSE", "RED_TEAM", "COMMAND"],
        roles: ["SOC Division", "Code Security", "Malware Lab", "Offensive Security"],
        allowedScopes: ["sandbox:isolated", "lab:isolated"],
        requiresApproval: true,
        requiresPrivilegedGrant: false
      },
      "privileged:ops": {
        modes: ["DEFENSE", "COMMAND"],
        roles: [
          "Intelligence",
          "Code Security",
          "Verification",
          "SOC Division",
          "Integrity & Audit",
          "Cyber Defense",
          "AI Research",
          "Cloud Security",
          "Network Intelligence",
          "Malware Lab",
          "Offensive Security"
        ],
        allowedScopes: ["local:machine", "sandbox:isolated"],
        requiresApproval: false,
        requiresPrivilegedGrant: true
      }
    };

    fs.mkdirSync(path.dirname(this.ledgerPath), { recursive: true });
    this._loadRegistry();
    this._loadLedgerState();
  }

  _loadRegistry() {
    this.registryById.clear();
    if (!fs.existsSync(this.agentsCatalogPath)) return;
    const raw = JSON.parse(fs.readFileSync(this.agentsCatalogPath, "utf8"));
    const list = Array.isArray(raw) ? raw : raw.agents;
    if (!Array.isArray(list)) return;
    for (const ag of list) {
      if (ag && ag.id) {
        this.registryById.set(String(ag.id), ag);
      }
    }
  }

  getRegisteredProfile(agentId) {
    if (!agentId) return null;
    return this.registryById.get(String(agentId)) || null;
  }

  getRegistryStats() {
    const byRole = {};
    for (const ag of this.registryById.values()) {
      const r = ag.role || "UNSPECIFIED";
      byRole[r] = (byRole[r] || 0) + 1;
    }
    return {
      total: this.registryById.size,
      byRole,
      privilegeGrantActive: this.hasActivePrivilege("REGISTRY_CHECK"),
      killSwitchActive: this.killSwitchActive
    };
  }

  _loadLedgerState() {
    this.lastSeq = 0;
    this.lastHash = "GENESIS";
    if (!fs.existsSync(this.ledgerPath)) return;

    const lines = fs
      .readFileSync(this.ledgerPath, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      const entry = JSON.parse(line);
      this.lastSeq = entry.seq;
      this.lastHash = entry.hash;
    }
  }

  _appendBlackBox(eventType, details) {
    const now = Date.now();
    const seq = this.lastSeq + 1;
    const prevHash = this.lastHash;
    const baseRecord = {
      seq,
      ts: new Date(now).toISOString(),
      eventType,
      prevHash,
      details
    };
    const hash = sha256(JSON.stringify(baseRecord));
    const fullRecord = { ...baseRecord, hash };

    fs.appendFileSync(this.ledgerPath, JSON.stringify(fullRecord) + "\n", "utf8");
    this.lastSeq = seq;
    this.lastHash = hash;
    return fullRecord;
  }

  grantPrivilegeMode({ agentIds = [], ttlMs = 300000, reason = "OWNER_COMMAND" } = {}) {
    const now = Date.now();
    const set = new Set(Array.isArray(agentIds) ? agentIds.map(String) : []);
    this.privilegedGrant = {
      active: true,
      agentIds: set,
      grantedAt: now,
      expiresAt: now + ttlMs,
      reason
    };
    const audit = this._appendBlackBox("PRIVILEGE_GRANTED", {
      agentScopeCount: set.size === 0 ? "ALL_REGISTERED_IN_SCOPE" : set.size,
      expiresAt: this.privilegedGrant.expiresAt,
      reason
    });
    return { active: true, expiresAt: this.privilegedGrant.expiresAt, audit };
  }

  revokePrivilegeMode(reason = "OWNER_REVOKE_COMMAND") {
    const wasActive = this.privilegedGrant.active;
    this.privilegedGrant = {
      active: false,
      agentIds: new Set(),
      grantedAt: null,
      expiresAt: null,
      reason
    };
    const audit = this._appendBlackBox("PRIVILEGE_REVOKED", {
      wasActive,
      reason
    });
    return { active: false, wasActive, audit };
  }

  hasActivePrivilege(agentId) {
    if (!this.privilegedGrant.active) return false;
    if (Date.now() >= this.privilegedGrant.expiresAt) {
      this.revokePrivilegeMode("PRIVILEGE_WINDOW_EXPIRED");
      return false;
    }
    if (this.privilegedGrant.agentIds.size === 0) return true;
    return this.privilegedGrant.agentIds.has(String(agentId));
  }

  verifyLedger() {
    if (!fs.existsSync(this.ledgerPath)) {
      return { valid: true, entries: 0, reason: "EMPTY_LEDGER" };
    }
    const lines = fs
      .readFileSync(this.ledgerPath, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    let expectedPrev = "GENESIS";
    let expectedSeq = 1;

    for (const line of lines) {
      const entry = JSON.parse(line);
      if (entry.seq !== expectedSeq || entry.prevHash !== expectedPrev) {
        return { valid: false, atSeq: entry.seq, reason: "CHAIN_LINK_BROKEN" };
      }
      const { hash, ...rest } = entry;
      const recomputed = sha256(JSON.stringify(rest));
      if (!timingSafeEqualHex(hash, recomputed)) {
        return { valid: false, atSeq: entry.seq, reason: "HASH_MISMATCH" };
      }
      expectedPrev = hash;
      expectedSeq += 1;
    }

    return { valid: true, entries: lines.length, headHash: expectedPrev };
  }

  signRequest(requestBody) {
    const payload = JSON.stringify(requestBody);
    return crypto.createHmac("sha256", this.secretKey).update(payload).digest("hex");
  }

  issueOneTimeApproval({ agentId, capability, scope, actionPayload, ttlMs = 60000 }) {
    const approvalId = `APR-${crypto.randomBytes(8).toString("hex")}`;
    const payloadHash = sha256(JSON.stringify(actionPayload || {}));
    const expiresAt = Date.now() + ttlMs;
    this.approvals.set(approvalId, {
      used: false,
      expiresAt,
      agentId,
      capability,
      scope,
      payloadHash
    });
    this._appendBlackBox("APPROVAL_ISSUED", { approvalId, agentId, capability, scope, expiresAt });
    return approvalId;
  }

  _pruneNonces(now) {
    for (const [nonce, exp] of this.usedNonces.entries()) {
      if (exp <= now) this.usedNonces.delete(nonce);
    }
  }

  authorizeAndPrepare(envelope, signatureHex, executeFn) {
    const now = Date.now();
    this._pruneNonces(now);

    if (this.killSwitchActive) {
      const rec = this._appendBlackBox("EXECUTION_DENIED", {
        reason: "KILL_SWITCH_ACTIVE",
        agentId: envelope && envelope.agent && envelope.agent.id
      });
      return { allowed: false, reason: "KILL_SWITCH_ACTIVE", audit: rec };
    }

    if (!envelope || typeof envelope !== "object") {
      const rec = this._appendBlackBox("EXECUTION_DENIED", { reason: "INVALID_ENVELOPE" });
      return { allowed: false, reason: "INVALID_ENVELOPE", audit: rec };
    }

    const { agent, mode = "COMMAND", capability, scope, nonce, issuedAt, expiresAt, approvalId, payload } = envelope;

    if (!agent || !agent.id) {
      const rec = this._appendBlackBox("EXECUTION_DENIED", { reason: "MISSING_AGENT_IDENTITY" });
      return { allowed: false, reason: "MISSING_AGENT_IDENTITY", audit: rec };
    }

    // Проверка срещу регистрирания каталог (ако каталогът е зареден)
    const registered = this.getRegisteredProfile(agent.id);
    if (this.registryById.size > 0 && !registered) {
      const rec = this._appendBlackBox("EXECUTION_DENIED", {
        reason: "AGENT_NOT_IN_REGISTRY",
        agentId: agent.id
      });
      return { allowed: false, reason: "AGENT_NOT_IN_REGISTRY", audit: rec };
    }

    const effectiveRole = (registered && registered.role) || agent.role;
    if (!effectiveRole) {
      const rec = this._appendBlackBox("EXECUTION_DENIED", {
        reason: "MISSING_AGENT_ROLE",
        agentId: agent.id
      });
      return { allowed: false, reason: "MISSING_AGENT_ROLE", audit: rec };
    }

    const expectedSig = this.signRequest(envelope);
    if (!timingSafeEqualHex(signatureHex, expectedSig)) {
      const rec = this._appendBlackBox("EXECUTION_DENIED", {
        reason: "INVALID_HMAC_SIGNATURE",
        agentId: agent.id,
        capability
      });
      return { allowed: false, reason: "INVALID_HMAC_SIGNATURE", audit: rec };
    }

    if (!nonce || typeof nonce !== "string" || this.usedNonces.has(nonce)) {
      const rec = this._appendBlackBox("EXECUTION_DENIED", {
        reason: "REPLAY_OR_MISSING_NONCE",
        agentId: agent.id,
        nonce
      });
      return { allowed: false, reason: "REPLAY_OR_MISSING_NONCE", audit: rec };
    }

    if (typeof expiresAt !== "number" || expiresAt <= now) {
      const rec = this._appendBlackBox("EXECUTION_DENIED", {
        reason: "TOKEN_EXPIRED",
        agentId: agent.id
      });
      return { allowed: false, reason: "TOKEN_EXPIRED", audit: rec };
    }

    if (typeof issuedAt === "number" && issuedAt > now + this.maxClockSkewMs) {
      const rec = this._appendBlackBox("EXECUTION_DENIED", {
        reason: "FUTURE_TIMESTAMP",
        agentId: agent.id
      });
      return { allowed: false, reason: "FUTURE_TIMESTAMP", audit: rec };
    }

    const rule = this.policy[capability];
    if (!rule) {
      const rec = this._appendBlackBox("EXECUTION_DENIED", {
        reason: "CAPABILITY_NOT_ALLOWED_DEFAULT_DENY",
        agentId: agent.id,
        capability
      });
      return { allowed: false, reason: "CAPABILITY_NOT_ALLOWED_DEFAULT_DENY", audit: rec };
    }

    if (Array.isArray(rule.modes) && !rule.modes.includes(mode)) {
      const rec = this._appendBlackBox("EXECUTION_DENIED", {
        reason: "MODE_NOT_ALLOWED_FOR_CAPABILITY",
        agentId: agent.id,
        mode,
        capability
      });
      return { allowed: false, reason: "MODE_NOT_ALLOWED_FOR_CAPABILITY", audit: rec };
    }

    if (rule.requiresPrivilegedGrant && !this.hasActivePrivilege(agent.id)) {
      const rec = this._appendBlackBox("EXECUTION_DENIED", {
        reason: "PRIVILEGED_MODE_NOT_GRANTED_BY_OWNER",
        agentId: agent.id,
        capability
      });
      return { allowed: false, reason: "PRIVILEGED_MODE_NOT_GRANTED_BY_OWNER", audit: rec };
    }

    if (!rule.roles.includes(effectiveRole)) {
      const rec = this._appendBlackBox("EXECUTION_DENIED", {
        reason: "ROLE_NOT_AUTHORIZED_FOR_CAPABILITY",
        agentId: agent.id,
        role: effectiveRole,
        capability
      });
      return { allowed: false, reason: "ROLE_NOT_AUTHORIZED_FOR_CAPABILITY", audit: rec };
    }

    if (!rule.allowedScopes.includes(scope)) {
      const rec = this._appendBlackBox("EXECUTION_DENIED", {
        reason: "SCOPE_VIOLATION_DEFAULT_DENY",
        agentId: agent.id,
        scope,
        capability
      });
      return { allowed: false, reason: "SCOPE_VIOLATION_DEFAULT_DENY", audit: rec };
    }

    if (rule.requiresApproval) {
      const apr = approvalId ? this.approvals.get(approvalId) : null;
      const expectedPayloadHash = sha256(JSON.stringify(payload || {}));
      if (
        !apr ||
        apr.used ||
        apr.expiresAt <= now ||
        apr.agentId !== agent.id ||
        apr.capability !== capability ||
        apr.scope !== scope ||
        apr.payloadHash !== expectedPayloadHash
      ) {
        const rec = this._appendBlackBox("EXECUTION_DENIED", {
          reason: "INVALID_OR_MISSING_ONE_TIME_APPROVAL",
          agentId: agent.id,
          capability,
          scope,
          approvalId
        });
        return { allowed: false, reason: "INVALID_OR_MISSING_ONE_TIME_APPROVAL", audit: rec };
      }
      apr.used = true;
    }

    this.usedNonces.set(nonce, Math.max(expiresAt, now + 60000));

    const result =
      typeof executeFn === "function"
        ? executeFn({
            agent: { ...agent, role: effectiveRole, profileHash: (registered && registered.profileHash) || agent.profileHash || null },
            mode,
            capability,
            scope,
            payload
          })
        : { status: "NO_EXECUTOR_BOUND" };
    const resultHash = sha256(JSON.stringify(result));
    const audit = this._appendBlackBox("EXECUTION_VERIFIED", {
      agentId: agent.id,
      role: effectiveRole,
      mode,
      capability,
      scope,
      approvalId: approvalId || null,
      resultHash
    });

    return { allowed: true, result, resultHash, audit };
  }
}

module.exports = { MarauderRootController, sha256 };
