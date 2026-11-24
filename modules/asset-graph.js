const fs = require("fs");
const path = require("path");
const { sha256 } = require("./black-box-parliament");

const SNAPSHOT_DIR = path.join(__dirname, "..", "data", "graph-snapshots");
const VALID_TYPES = new Set([
  "ORGANIZATION", "DOMAIN", "API", "SERVICE", "SERVER",
  "CONTAINER", "REPOSITORY", "IDENTITY", "DEPENDENCY", "FINDING"
]);
const VALID_LIFECYCLE = new Set([
  "DISCOVERED", "VERIFIED", "MONITORED", "AT_RISK", "REMEDIATED", "QUARANTINED", "ARCHIVED"
]);

class AssetGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = [];
    this.snapshots = [];
    fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
  }

  upsertNode({ id, type = "SERVER", name, owner = "unassigned", criticality = 50, lifecycle = "DISCOVERED", tags = [], metadata = {} }) {
    const cleanType = String(type).toUpperCase();
    if (!VALID_TYPES.has(cleanType)) {
      throw new Error(`INVALID_ASSET_TYPE:${cleanType}`);
    }
    const cleanLife = VALID_LIFECYCLE.has(String(lifecycle).toUpperCase())
      ? String(lifecycle).toUpperCase()
      : "DISCOVERED";

    const nodeId = id || `${cleanType.toLowerCase()}:${name}`;
    const prev = this.nodes.get(nodeId);
    const node = {
      id: nodeId,
      type: cleanType,
      name: name || nodeId,
      owner,
      criticality: Math.max(0, Math.min(100, Number(criticality) || 50)),
      lifecycle: cleanLife,
      tags: Array.from(new Set(tags)),
      metadata: { ...(prev ? prev.metadata : {}), ...metadata },
      updatedAt: new Date().toISOString()
    };
    this.nodes.set(nodeId, node);
    return { node, changed: !prev || sha256(prev) !== sha256(node) };
  }

  linkNodes({ fromId, toId, relation = "DEPENDS_ON" }) {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) {
      throw new Error("LINK_TARGET_NODE_MISSING");
    }
    const exists = this.edges.some((e) => e.fromId === fromId && e.toId === toId && e.relation === relation);
    if (!exists) {
      this.edges.push({ fromId, toId, relation, createdAt: new Date().toISOString() });
    }
    return { fromId, toId, relation, added: !exists };
  }

  detectGaps() {
    const gaps = [];
    for (const node of this.nodes.values()) {
      if (!node.owner || node.owner === "unassigned") {
        gaps.push({ nodeId: node.id, gap: "OWNERSHIP_GAP", severity: "MEDIUM" });
      }
      if (!node.tags.includes("monitored") && node.lifecycle !== "ARCHIVED") {
        gaps.push({ nodeId: node.id, gap: "MONITORING_GAP", severity: "MEDIUM" });
      }
      if (node.lifecycle === "AT_RISK") {
        gaps.push({ nodeId: node.id, gap: "PATCH_OR_CONFIG_GAP", severity: "HIGH" });
      }
    }
    const incomingCount = new Map();
    for (const e of this.edges) {
      incomingCount.set(e.toId, (incomingCount.get(e.toId) || 0) + 1);
    }
    const singlePointsOfFailure = [];
    for (const [id, count] of incomingCount.entries()) {
      if (count >= 3) {
        singlePointsOfFailure.push({ nodeId: id, dependents: count, risk: "CONCENTRATION_SPOF" });
      }
    }
    return { totalGaps: gaps.length, gaps, singlePointsOfFailure };
  }

  takeSnapshot(label = "snapshot") {
    const payload = {
      label,
      takenAt: new Date().toISOString(),
      nodes: Array.from(this.nodes.values()),
      edges: this.edges
    };
    payload.digest = sha256(payload);
    this.snapshots.push(payload);
    fs.writeFileSync(path.join(SNAPSHOT_DIR, `${Date.now()}-${label}.json`), JSON.stringify(payload, null, 2));
    return { label, digest: payload.digest, nodeCount: payload.nodes.length, edgeCount: payload.edges.length };
  }

  diffSnapshots(idxA, idxB) {
    const a = this.snapshots[idxA];
    const b = this.snapshots[idxB];
    if (!a || !b) throw new Error("SNAPSHOT_INDEX_OUT_OF_RANGE");
    const mapA = new Map(a.nodes.map((n) => [n.id, n]));
    const mapB = new Map(b.nodes.map((n) => [n.id, n]));

    const added = [];
    const removed = [];
    const modified = [];

    for (const [id, nb] of mapB.entries()) {
      if (!mapA.has(id)) added.push(id);
      else if (sha256(mapA.get(id)) !== sha256(nb)) modified.push(id);
    }
    for (const id of mapA.keys()) {
      if (!mapB.has(id)) removed.push(id);
    }
    return { from: a.label, to: b.label, added, removed, modified };
  }
}

module.exports = AssetGraph;
