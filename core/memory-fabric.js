"use strict";

const fs = require("fs");
const path = require("path");
const { createHash, randomUUID } = require("crypto");

function sha256Hex(input) {
  const raw = typeof input === "string" ? input : JSON.stringify(input);
  return createHash("sha256").update(raw).digest("hex");
}

function computeEntryHash(payload, prevHash = "GENESIS") {
  return sha256Hex(`${prevHash}|${JSON.stringify(payload)}`);
}

class MemoryFabric {
  constructor(options = {}) {
    this.incidents = new Map();
    this.policies = new Map();
    this.assets = new Map();
    this.knowledge = new Map();
    this.missions = new Map();
    this.reports = new Map();
    this.checkpoints = new Map();
    this.auditLedger = [];
    this.maxAuditEntries = Math.max(100, Number(options.maxAuditEntries || 5000));
    this.lastSnapshotHash = "GENESIS";

    if (options.seedDefaultPolicies !== false) {
      this.upsertPolicy({
        id: "POL-HUMAN-APPROVAL-DEFAULT",
        name: "Human Approval Required for Critical Actions",
        enabled: true,
        rules: {
          defaultHumanApproved: false,
          automaticWeaponsRelease: false,
          requireRootController: true
        }
      });
    }
  }

  recordAudit(eventType, details = {}, actor = "marauder-core") {
    const prevHash =
      this.auditLedger.length > 0
        ? this.auditLedger[this.auditLedger.length - 1].hash
        : "GENESIS";

    const entry = {
      id: randomUUID(),
      ts: new Date().toISOString(),
      actor: String(actor || "marauder-core"),
      eventType: String(eventType || "AUDIT_EVENT"),
      details,
      prevHash
    };
    entry.hash = computeEntryHash(
      {
        id: entry.id,
        ts: entry.ts,
        actor: entry.actor,
        eventType: entry.eventType,
        details: entry.details
      },
      prevHash
    );

    this.auditLedger.push(entry);
    if (this.auditLedger.length > this.maxAuditEntries) {
      this.auditLedger.shift();
    }
    return entry;
  }

  verifyAuditChain(ledger = this.auditLedger) {
    if (!Array.isArray(ledger)) {
      return { valid: false, reason: "AUDIT_LEDGER_NOT_ARRAY" };
    }
    let expectedPrev = "GENESIS";
    for (let i = 0; i < ledger.length; i++) {
      const item = ledger[i];
      if (!item || item.prevHash !== expectedPrev) {
        return {
          valid: false,
          index: i,
          id: item && item.id ? item.id : null,
          reason: "BROKEN_PREV_HASH"
        };
      }
      const recalculated = computeEntryHash(
        {
          id: item.id,
          ts: item.ts,
          actor: item.actor,
          eventType: item.eventType,
          details: item.details
        },
        item.prevHash
      );
      if (recalculated !== item.hash) {
        return {
          valid: false,
          index: i,
          id: item.id,
          reason: "HASH_MISMATCH"
        };
      }
      expectedPrev = item.hash;
    }

    return {
      valid: true,
      count: ledger.length,
      headHash: expectedPrev
    };
  }

  recordIncident(incident = {}, actor = "soc-analyst") {
    const id = incident.id || `INC-${randomUUID().slice(0, 8).toUpperCase()}`;
    const existing = this.incidents.get(id);
    const record = {
      id,
      title: String(incident.title || existing?.title || "Security Incident"),
      severity: String(incident.severity || existing?.severity || "medium"),
      status: String(incident.status || existing?.status || "open"),
      riskScore: Number(incident.riskScore ?? existing?.riskScore ?? 50),
      source: String(incident.source || existing?.source || "telemetry"),
      missionId: incident.missionId || existing?.missionId || null,
      evidence: Array.isArray(incident.evidence)
        ? [...incident.evidence]
        : [...(existing?.evidence || [])],
      notes: String(incident.notes || existing?.notes || ""),
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.incidents.set(id, record);
    this.recordAudit(
      existing ? "INCIDENT_UPDATED" : "INCIDENT_RECORDED",
      {
        incidentId: record.id,
        severity: record.severity,
        status: record.status,
        riskScore: record.riskScore
      },
      actor
    );
    return record;
  }

  getIncident(id) {
    return this.incidents.get(id) || null;
  }

  listIncidents(filter = {}) {
    return Array.from(this.incidents.values()).filter((inc) => {
      if (filter.status && inc.status !== filter.status) return false;
      if (filter.severity && inc.severity !== filter.severity) return false;
      return true;
    });
  }

  upsertPolicy(policy = {}, actor = "policy-engine") {
    const id = policy.id || `POL-${randomUUID().slice(0, 8).toUpperCase()}`;
    const prev = this.policies.get(id);
    const nextVersion = prev ? prev.version + 1 : 1;

    const record = {
      id,
      name: String(policy.name || prev?.name || "Unnamed Policy"),
      enabled: policy.enabled !== undefined ? Boolean(policy.enabled) : true,
      version: nextVersion,
      rules:
        policy.rules && typeof policy.rules === "object"
          ? { ...(prev?.rules || {}), ...policy.rules }
          : { ...(prev?.rules || {}) },
      updatedAt: new Date().toISOString()
    };

    this.policies.set(id, record);
    this.recordAudit(
      "POLICY_UPSERTED",
      {
        policyId: record.id,
        version: record.version,
        enabled: record.enabled
      },
      actor
    );
    return record;
  }

  getPolicy(id) {
    return this.policies.get(id) || null;
  }

  listPolicies() {
    return Array.from(this.policies.values());
  }

  upsertAsset(asset = {}, actor = "asset-inventory") {
    const id = asset.id || `AST-${randomUUID().slice(0, 8).toUpperCase()}`;
    const prev = this.assets.get(id);

    const record = {
      id,
      hostname: String(asset.hostname || prev?.hostname || id),
      assetType: String(asset.assetType || prev?.assetType || "host"),
      environment: String(asset.environment || prev?.environment || "production"),
      status: String(asset.status || prev?.status || "online"),
      tags: Array.isArray(asset.tags) ? [...asset.tags] : [...(prev?.tags || [])],
      metadata:
        asset.metadata && typeof asset.metadata === "object"
          ? { ...(prev?.metadata || {}), ...asset.metadata }
          : { ...(prev?.metadata || {}) },
      lastSeenAt: new Date().toISOString()
    };

    this.assets.set(id, record);
    this.recordAudit(
      "ASSET_UPSERTED",
      {
        assetId: record.id,
        hostname: record.hostname,
        environment: record.environment,
        status: record.status
      },
      actor
    );
    return record;
  }

  getAsset(id) {
    return this.assets.get(id) || null;
  }

  listAssets(filter = {}) {
    return Array.from(this.assets.values()).filter((ast) => {
      if (filter.environment && ast.environment !== filter.environment) return false;
      if (filter.status && ast.status !== filter.status) return false;
      return true;
    });
  }

  indexKnowledge(entry = {}, actor = "knowledge-hub") {
    const id = entry.id || `KNW-${randomUUID().slice(0, 8).toUpperCase()}`;
    const record = {
      id,
      topic: String(entry.topic || "general"),
      title: String(entry.title || "Knowledge Entry"),
      content: String(entry.content || ""),
      tags: Array.isArray(entry.tags) ? [...entry.tags] : [],
      source: String(entry.source || "local"),
      updatedAt: new Date().toISOString()
    };
    this.knowledge.set(id, record);
    this.recordAudit("KNOWLEDGE_INDEXED", { knowledgeId: record.id, topic: record.topic }, actor);
    return record;
  }

  searchKnowledge(query = "") {
    const q = String(query || "").trim().toLowerCase();
    const all = Array.from(this.knowledge.values());
    if (!q) return all;
    return all.filter((item) =>
      [item.id, item.topic, item.title, item.content, ...(item.tags || [])]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }

  upsertMissionState(missionState = {}, actor = "mission-planner") {
    if (!missionState || !missionState.id) {
      throw new Error("MISSION_STATE_ID_REQUIRED");
    }
    const existing = this.missions.get(missionState.id) || {};
    const record = {
      ...existing,
      ...missionState,
      id: missionState.id,
      humanApproved: missionState.humanApproved === true,
      updatedAt: new Date().toISOString()
    };
    this.missions.set(record.id, record);
    this.recordAudit(
      "MISSION_STATE_PERSISTED",
      {
        missionId: record.id,
        status: record.status || "unknown",
        humanApproved: record.humanApproved
      },
      actor
    );
    return record;
  }

  getMissionState(missionId) {
    return this.missions.get(missionId) || null;
  }

  storeReport(report = {}, actor = "reporting-agent") {
    const id = report.id || `RPT-${randomUUID().slice(0, 8).toUpperCase()}`;
    const record = {
      id,
      missionId: report.missionId || null,
      title: String(report.title || "Defensive Assessment Report"),
      summary: String(report.summary || ""),
      verified: Boolean(report.verified),
      createdAt: new Date().toISOString(),
      data: report.data && typeof report.data === "object" ? { ...report.data } : {}
    };
    this.reports.set(id, record);
    this.recordAudit("REPORT_STORED", { reportId: record.id, missionId: record.missionId }, actor);
    return record;
  }

  createCheckpoint(label = "checkpoint", context = {}) {
    const id = `CHK-${randomUUID().slice(0, 8).toUpperCase()}`;
    const chainCheck = this.verifyAuditChain();
    const body = {
      id,
      label: String(label || "checkpoint"),
      createdAt: new Date().toISOString(),
      auditChainValidAtCreation: chainCheck.valid,
      state: {
        incidents: Array.from(this.incidents.entries()),
        policies: Array.from(this.policies.entries()),
        assets: Array.from(this.assets.entries()),
        knowledge: Array.from(this.knowledge.entries()),
        missions: Array.from(this.missions.entries()),
        reports: Array.from(this.reports.entries()),
        auditLedger: [...this.auditLedger]
      },
      context: {
        agentRoster: Array.isArray(context.agentRoster) ? [...context.agentRoster] : [],
        configSummary: context.configSummary || {}
      }
    };
    const integrity = {
      algorithm: "sha256",
      hash: sha256Hex(body)
    };
    const checkpoint = { ...body, integrity };
    this.checkpoints.set(id, checkpoint);
    this.recordAudit("CHECKPOINT_CREATED", { checkpointId: id, label: checkpoint.label, hash: integrity.hash }, "checkpoint-manager");
    return checkpoint;
  }

  restoreCheckpoint(checkpointOrId) {
    const cp =
      typeof checkpointOrId === "string"
        ? this.checkpoints.get(checkpointOrId)
        : checkpointOrId;

    if (!cp || !cp.state || !cp.integrity || !cp.integrity.hash) {
      return { ok: false, reason: "INVALID_CHECKPOINT_STRUCTURE" };
    }

    const { integrity, ...bodyToHash } = cp;
    const expectedHash = sha256Hex(bodyToHash);
    if (expectedHash !== integrity.hash) {
      return { ok: false, reason: "CHECKPOINT_HASH_MISMATCH", checkpointId: cp.id };
    }

    const restoredLedger = Array.isArray(cp.state.auditLedger) ? [...cp.state.auditLedger] : [];
    const chainCheck = this.verifyAuditChain(restoredLedger);
    if (!chainCheck.valid) {
      return { ok: false, reason: "CHECKPOINT_AUDIT_CHAIN_INVALID", details: chainCheck };
    }

    this.incidents = new Map(Array.isArray(cp.state.incidents) ? cp.state.incidents : []);
    this.policies = new Map(Array.isArray(cp.state.policies) ? cp.state.policies : []);
    this.assets = new Map(Array.isArray(cp.state.assets) ? cp.state.assets : []);
    this.knowledge = new Map(Array.isArray(cp.state.knowledge) ? cp.state.knowledge : []);
    this.missions = new Map(Array.isArray(cp.state.missions) ? cp.state.missions : []);
    this.reports = new Map(Array.isArray(cp.state.reports) ? cp.state.reports : []);
    this.auditLedger = restoredLedger;

    this.recordAudit("CHECKPOINT_RESTORED", { checkpointId: cp.id, hash: integrity.hash }, "recovery-manager");
    return {
      ok: true,
      checkpointId: cp.id,
      integrityValid: true,
      auditIntegrity: this.verifyAuditChain()
    };
  }

  exportKnowledge(source = "local") {
    const entries = Array.from(this.knowledge.values());
    const payload = {
      format: "MARAUDER-KNOWLEDGE",
      version: 2,
      createdAt: new Date().toISOString(),
      source: String(source || "local"),
      entries
    };
    return {
      ...payload,
      integrity: {
        algorithm: "sha256",
        hash: sha256Hex(payload)
      }
    };
  }

  importKnowledge(bundle = {}, actor = "knowledge-hub") {
    if (!bundle || bundle.format !== "MARAUDER-KNOWLEDGE" || Number(bundle.version) !== 2) {
      return { ok: false, reason: "UNSUPPORTED_KNOWLEDGE_BUNDLE_FORMAT" };
    }
    const { integrity, ...body } = bundle;
    if (!integrity || sha256Hex(body) !== integrity.hash) {
      return { ok: false, reason: "KNOWLEDGE_BUNDLE_HASH_MISMATCH" };
    }
    const entries = Array.isArray(bundle.entries) ? bundle.entries : [];
    for (const item of entries) {
      if (item && item.id) {
        this.knowledge.set(item.id, { ...item, importedAt: new Date().toISOString() });
      }
    }
    this.recordAudit("KNOWLEDGE_IMPORTED", { importedCount: entries.length, source: bundle.source || "unknown" }, actor);
    return { ok: true, importedCount: entries.length, totalKnowledge: this.knowledge.size };
  }

  _writeFileAtomicAndFsync(targetPath, contentStr) {
    const resolved = path.resolve(targetPath);
    const dir = path.dirname(resolved);
    fs.mkdirSync(dir, { recursive: true });

    const tmpPath = path.join(dir, `.tmp-${process.pid}-${randomUUID()}.json`);
    const fd = fs.openSync(tmpPath, "w");
    try {
      fs.writeSync(fd, contentStr, 0, "utf8");
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    fs.renameSync(tmpPath, resolved);

    try {
      const dirFd = fs.openSync(dir, "r");
      try {
        fs.fsyncSync(dirFd);
      } finally {
        fs.closeSync(dirFd);
      }
    } catch (_) {
      // Игнорираме при файлови системи без поддръжка на fsync върху директория
    }
    return resolved;
  }

  _formatSnapshotStamp(dateObj = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    return [
      dateObj.getUTCFullYear(),
      pad(dateObj.getUTCMonth() + 1),
      pad(dateObj.getUTCDate()),
      "-",
      pad(dateObj.getUTCHours()),
      pad(dateObj.getUTCMinutes()),
      pad(dateObj.getUTCSeconds())
    ].join("");
  }

  _buildSnapshotEnvelope(snapshotId, createdAt, previousSnapshotHash, data) {
    const body = {
      format: "MARAUDER-MEMORY-HUB",
      schemaVersion: 1,
      snapshotId,
      createdAt,
      previousSnapshotHash,
      data
    };
    return {
      ...body,
      snapshotHash: sha256Hex(body)
    };
  }

  validateSnapshotEnvelope(parsed) {
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, reason: "INVALID_SNAPSHOT_OBJECT" };
    }
    if (parsed.format !== "MARAUDER-MEMORY-HUB") {
      return { ok: false, reason: "INVALID_SNAPSHOT_FORMAT" };
    }
    if (Number(parsed.schemaVersion) !== 1) {
      return { ok: false, reason: "UNSUPPORTED_SCHEMA_VERSION", schemaVersion: parsed.schemaVersion };
    }
    if (!parsed.snapshotHash || !parsed.data || typeof parsed.data !== "object") {
      return { ok: false, reason: "MISSING_SNAPSHOT_HASH_OR_DATA" };
    }

    const { snapshotHash, ...bodyWithoutHash } = parsed;
    const expectedHash = sha256Hex(bodyWithoutHash);
    if (expectedHash !== snapshotHash) {
      return { ok: false, reason: "SNAPSHOT_HASH_MISMATCH" };
    }

    const candidateLedger = Array.isArray(parsed.data.auditLedger) ? parsed.data.auditLedger : null;
    if (!candidateLedger) {
      return { ok: false, reason: "MISSING_AUDIT_LEDGER_IN_SNAPSHOT" };
    }

    const chainCheck = this.verifyAuditChain(candidateLedger);
    if (!chainCheck.valid) {
      return { ok: false, reason: "SNAPSHOT_AUDIT_CHAIN_INVALID", details: chainCheck };
    }

    return { ok: true, chainCheck };
  }

  saveSnapshot(filePath, options = {}) {
    if (!filePath || typeof filePath !== "string") {
      throw new Error("SNAPSHOT_FILE_PATH_REQUIRED");
    }
    const chainBeforeSave = this.verifyAuditChain();
    if (!chainBeforeSave.valid) {
      return {
        ok: false,
        path: path.resolve(filePath),
        reason: "AUDIT_CHAIN_INVALID_BEFORE_SAVE",
        integrity: chainBeforeSave
      };
    }

    const resolvedTarget = path.resolve(filePath);
    const snapshotId = `SNAP-${randomUUID().slice(0, 8).toUpperCase()}`;
    const createdAt = new Date().toISOString();

    this.recordAudit(
      "SNAPSHOT_CREATED",
      {
        snapshotId,
        target: resolvedTarget,
        previousSnapshotHash: this.lastSnapshotHash
      },
      "snapshot-manager"
    );

    const data = {
      incidents: Array.from(this.incidents.entries()),
      policies: Array.from(this.policies.entries()),
      assets: Array.from(this.assets.entries()),
      knowledge: Array.from(this.knowledge.entries()),
      missions: Array.from(this.missions.entries()),
      reports: Array.from(this.reports.entries()),
      auditLedger: [...this.auditLedger]
    };

    const envelope = this._buildSnapshotEnvelope(
      snapshotId,
      createdAt,
      this.lastSnapshotHash,
      data
    );
    const serialized = JSON.stringify(envelope, null, 2);

    const useDirectoryMode =
      options.versionedDirectory === true ||
      (fs.existsSync(resolvedTarget) && fs.statSync(resolvedTarget).isDirectory());

    const snapshotsDir = useDirectoryMode ? resolvedTarget : path.dirname(resolvedTarget);
    const versionedName = `memory-${this._formatSnapshotStamp(new Date(createdAt))}-${snapshotId.slice(-4)}.json`;
    const versionedPath = path.join(snapshotsDir, versionedName);
    const latestPath = path.join(snapshotsDir, "latest.json");

    this._writeFileAtomicAndFsync(versionedPath, serialized);
    if (!useDirectoryMode) {
      this._writeFileAtomicAndFsync(resolvedTarget, serialized);
    }
    this._writeFileAtomicAndFsync(latestPath, serialized);

    this.lastSnapshotHash = envelope.snapshotHash;
    const finalChain = this.verifyAuditChain();

    return {
      ok: true,
      snapshotId,
      schemaVersion: 1,
      snapshotHash: envelope.snapshotHash,
      previousSnapshotHash: envelope.previousSnapshotHash,
      path: useDirectoryMode ? versionedPath : resolvedTarget,
      versionedPath,
      latestPath,
      incidentsCount: this.incidents.size,
      policiesCount: this.policies.size,
      assetsCount: this.assets.size,
      knowledgeCount: this.knowledge.size,
      missionsCount: this.missions.size,
      reportsCount: this.reports.size,
      auditCount: this.auditLedger.length,
      integrity: finalChain
    };
  }

  loadSnapshot(filePath, options = {}) {
    if (!filePath || typeof filePath !== "string") {
      throw new Error("SNAPSHOT_FILE_PATH_REQUIRED");
    }
    const resolved = path.resolve(filePath);
    if (!fs.existsSync(resolved)) {
      return {
        ok: false,
        path: resolved,
        reason: "SNAPSHOT_NOT_FOUND"
      };
    }

    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
    } catch (err) {
      return {
        ok: false,
        path: resolved,
        reason: "SNAPSHOT_JSON_PARSE_ERROR",
        error: err && err.message ? err.message : "PARSE_ERROR"
      };
    }

    const check = this.validateSnapshotEnvelope(parsed);
    if (!check.ok && options.strictIntegrity !== false) {
      return {
        ok: false,
        path: resolved,
        reason: check.reason,
        details: check.details || null
      };
    }

    const d = parsed.data || {};
    this.incidents = new Map(Array.isArray(d.incidents) ? d.incidents : []);
    this.policies = new Map(Array.isArray(d.policies) ? d.policies : []);
    this.assets = new Map(Array.isArray(d.assets) ? d.assets : []);
    this.knowledge = new Map(Array.isArray(d.knowledge) ? d.knowledge : []);
    this.missions = new Map(Array.isArray(d.missions) ? d.missions : []);
    this.reports = new Map(Array.isArray(d.reports) ? d.reports : []);
    this.auditLedger = Array.isArray(d.auditLedger) ? [...d.auditLedger] : [];
    this.lastSnapshotHash = parsed.snapshotHash || this.lastSnapshotHash;

    if (options.recordLoadEvent === true) {
      this.recordAudit(
        "SNAPSHOT_LOADED",
        { path: resolved, snapshotId: parsed.snapshotId || null, snapshotHash: parsed.snapshotHash || null },
        "recovery-manager"
      );
    }

    return {
      ok: true,
      path: resolved,
      snapshotId: parsed.snapshotId || null,
      schemaVersion: parsed.schemaVersion || 1,
      snapshotHash: parsed.snapshotHash || null,
      previousSnapshotHash: parsed.previousSnapshotHash || null,
      incidentsCount: this.incidents.size,
      policiesCount: this.policies.size,
      assetsCount: this.assets.size,
      knowledgeCount: this.knowledge.size,
      missionsCount: this.missions.size,
      reportsCount: this.reports.size,
      auditCount: this.auditLedger.length,
      integrity: this.verifyAuditChain()
    };
  }

  recoverFromDirectory(snapshotsDir) {
    const dir = path.resolve(snapshotsDir);
    if (!fs.existsSync(dir)) {
      return { ok: false, dir, reason: "SNAPSHOTS_DIR_NOT_FOUND" };
    }

    const latestFile = path.join(dir, "latest.json");
    const candidates = [];

    if (fs.existsSync(latestFile)) {
      candidates.push(latestFile);
    }

    const files = fs
      .readdirSync(dir)
      .filter((f) => /^memory-.*\.json$/i.test(f))
      .sort()
      .reverse();

    for (const f of files) {
      const full = path.join(dir, f);
      if (!candidates.includes(full)) {
        candidates.push(full);
      }
    }

    const rejected = [];
    for (const candidatePath of candidates) {
      const res = this.loadSnapshot(candidatePath, { strictIntegrity: true, recordLoadEvent: false });
      if (res.ok) {
        this.recordAudit(
          "SNAPSHOT_RECOVERED",
          {
            recoveredFrom: candidatePath,
            snapshotId: res.snapshotId,
            snapshotHash: res.snapshotHash,
            rejectedCount: rejected.length
          },
          "recovery-manager"
        );
        return {
          ok: true,
          recoveredFrom: candidatePath,
          snapshotId: res.snapshotId,
          snapshotHash: res.snapshotHash,
          rejected,
          integrity: this.verifyAuditChain()
        };
      }
      rejected.push({ path: candidatePath, reason: res.reason });
    }

    return {
      ok: false,
      dir,
      reason: "NO_VALID_SNAPSHOT_FOUND",
      rejected
    };
  }

  getSnapshot() {
    return {
      incidentsCount: this.incidents.size,
      policiesCount: this.policies.size,
      assetsCount: this.assets.size,
      knowledgeCount: this.knowledge.size,
      missionsCount: this.missions.size,
      reportsCount: this.reports.size,
      checkpointsCount: this.checkpoints.size,
      auditCount: this.auditLedger.length,
      auditIntegrity: this.verifyAuditChain()
    };
  }
}

module.exports = { MemoryFabric };
