const crypto = require("crypto");

class MarauderGraphSwarm {
  constructor() {
    this.nodes = new Map();
    this.edges = [];
    this.verifiedFindings = [];
    this.quarantinedAgents = new Set();
  }

  upsertNode({ id, type, label, scope = "approved-lab", metadata = {} }) {
    if (!id || !type) {
      return { ok: false, error: "Изисква се id и type за възел в MARAUDER Graph." };
    }
    const key = `${String(type)}:${String(id)}`;
    const existing = this.nodes.get(key);
    const node = {
      key,
      id: String(id),
      type: String(type),
      label: String(label || id),
      scope: String(scope),
      metadata: { ...(existing ? existing.metadata : {}), ...metadata },
      updatedAt: new Date().toISOString()
    };
    this.nodes.set(key, node);
    return { ok: true, node };
  }

  linkNodes({ fromKey, toKey, relation, evidence = "" }) {
    if (!this.nodes.has(fromKey) || !this.nodes.has(toKey)) {
      return { ok: false, error: "Един от възлите липсва в MARAUDER Graph." };
    }
    const edge = {
      id: `EDGE-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      fromKey,
      toKey,
      relation: String(relation || "relates_to"),
      evidence: String(evidence || ""),
      createdAt: new Date().toISOString()
    };
    this.edges.push(edge);
    return { ok: true, edge };
  }

  quarantineAgent(agentName, reason = "Аномалия или загуба на интегритет") {
    const key = String(agentName || "").trim();
    if (!key) return { ok: false, error: "Липсва име на агент за изолация." };
    this.quarantinedAgents.add(key);
    return {
      ok: true,
      agentName: key,
      status: "QUARANTINED_AND_REVOKED",
      nextSteps: ["isolate", "revoke_credentials", "restart_clean_instance", "verify_integrity"],
      reason
    };
  }

  clearQuarantine(agentName) {
    this.quarantinedAgents.delete(String(agentName || "").trim());
    return { ok: true, agentName, status: "CLEAN_VERIFIED" };
  }

  crossCheckAndConfirm({
    primaryAgent,
    reviewerAgent,
    claim,
    assetKey,
    evidenceItems = [],
    disputedBySwarm = false,
    severity = "MEDIUM"
  }) {
    if (this.quarantinedAgents.has(String(primaryAgent || ""))) {
      return {
        ok: false,
        status: "REJECTED_QUARANTINED_AGENT",
        reason: `Агентът '${primaryAgent}' е в карантина и не може да публикува находки.`
      };
    }

    const cleanEvidence = Array.isArray(evidenceItems)
      ? evidenceItems.filter((x) => x && String(x).trim().length > 0)
      : [];

    const hasSecondVerifier = Boolean(String(reviewerAgent || "").trim()) && reviewerAgent !== primaryAgent;
    const hasAsset = !assetKey || this.nodes.has(assetKey);

    if (cleanEvidence.length === 0 || !hasSecondVerifier || disputedBySwarm || !hasAsset) {
      return {
        ok: true,
        confirmed: false,
        status: disputedBySwarm ? "DISPUTED_BY_SWARM" : "NEEDS_EVIDENCE_OR_SECOND_VERIFY",
        claim: String(claim || ""),
        evidenceCount: cleanEvidence.length,
        secondVerifierPresent: hasSecondVerifier,
        assetExistsInGraph: hasAsset
      };
    }

    const finding = {
      id: `VER-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      confirmed: true,
      status: "CONFIRMED",
      severity: String(severity || "MEDIUM").toUpperCase(),
      claim: String(claim || ""),
      assetKey: assetKey || null,
      primaryAgent: String(primaryAgent),
      reviewerAgent: String(reviewerAgent),
      evidence: cleanEvidence,
      confirmedAt: new Date().toISOString()
    };

    this.verifiedFindings.push(finding);
    return { ok: true, confirmed: true, finding };
  }

  getGraphSnapshot() {
    return {
      nodesCount: this.nodes.size,
      edgesCount: this.edges.length,
      confirmedFindingsCount: this.verifiedFindings.length,
      quarantinedAgents: Array.from(this.quarantinedAgents),
      nodes: Array.from(this.nodes.values()),
      edges: this.edges.slice(-50),
      verifiedFindings: this.verifiedFindings.slice(-30)
    };
  }
}

module.exports = { MarauderGraphSwarm };
