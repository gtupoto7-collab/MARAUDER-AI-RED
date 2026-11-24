const fs = require("fs");
const path = require("path");
const AgentRegistry = require("./agent-registry");
const CapabilityEngine = require("./capability-engine");
const ReadOnlyVerticalSlice = require("./vertical-slice");
const { Mission, BlackBox, Parliament } = require("./black-box-parliament");

const MISSIONS_DIR = path.join(__dirname, "..", "data", "missions");

class MissionOrchestrator {
  constructor(projectDir = process.cwd()) {
    this.projectDir = projectDir;
    this.registry = new AgentRegistry();
    this.capabilities = new CapabilityEngine();
    this.parliament = new Parliament();
    this.verticalSlice = new ReadOnlyVerticalSlice(projectDir);
    fs.mkdirSync(MISSIONS_DIR, { recursive: true });
  }

  selectTeam(objective) {
    const q = String(objective || "").toLowerCase();
    const neededCaps = ["filesystem.read", "network.observe"];
    if (/dep|npm|package|vuln|audit/.test(q)) neededCaps.unshift("security.scan");
    if (/port|socket|listen|net|dns/.test(q)) neededCaps.unshift("network.observe");
    if (/log|siem|event|process/.test(q)) neededCaps.unshift("process.inspect", "logs.read");

    const team = this.registry.matchByCapability(neededCaps, 4);
    return { neededCaps, team };
  }

  async runMission({ objective = "Assess my infrastructure", targetScope = "verified-local-lab" } = {}) {
    const mission = new Mission({ targetScope, objective });
    const blackBox = new BlackBox(mission);
    const { neededCaps, team } = this.selectTeam(objective);

    const grants = team.map((agent) => {
      const cap = agent.capabilities.find((c) => neededCaps.includes(c)) || agent.capabilities[0];
      return this.capabilities.grant({ agent, capability: cap, targetScope });
    });

    const activeGrants = grants.filter((g) => g.granted);
    if (activeGrants.length === 0) {
      blackBox.appendDecision({ stage: "DENIED", reason: "NO_CAPABILITY_GRANTED", grants });
      const fin = blackBox.finalizeMission("REJECTED");
      return { ok: false, missionId: mission.missionId, status: "REJECTED", grants, digest: fin.missionDigest };
    }

    // Използваме съществуващия read-only vertical slice за реални наблюдения и доказателства
    const sliceOut = await this.verticalSlice.executeSlice({ targetScope, objective });
    const depEv = {
      verified: Boolean(sliceOut.report.dependencyAudit && sliceOut.report.dependencyAudit.hasPkg),
      source: "vertical-slice:dependency-audit",
      summary: sliceOut.report.dependencyAudit.auditSummary,
      observedAt: new Date().toISOString()
    };
    const sockEv = {
      verified: Boolean(sliceOut.report.localListeners),
      source: "vertical-slice:local-listeners",
      listenersCount: sliceOut.report.localListeners.count,
      observedAt: new Date().toISOString()
    };

    blackBox.appendEvent({ type: "TEAM_SELECTED", neededCaps, selectedIds: team.map((a) => a.id) });
    blackBox.appendEvidence(depEv);
    blackBox.appendEvidence(sockEv);

    const risk = this.parliament.evaluateRisk({
      severity: sliceOut.report.riskAssessment.level,
      mutating: false
    });
    const proposal = this.parliament.propose({
      action: "orchestrated-read-only-assessment",
      targetScope,
      agentId: team[0].id,
      capability: activeGrants[0].capability
    });
    const policy = this.parliament.evaluatePolicy(proposal, risk);
    const quorumResult = this.parliament.quorum([
      { role: "Evidence Verifier", approve: depEv.verified && sockEv.verified },
      { role: "Policy Agent", approve: policy.allowed }
    ]);
    const auth = this.parliament.authorize({
      proposal,
      evidence: depEv,
      risk,
      policy,
      quorumResult,
      blackBox
    });

    const finalized = blackBox.finalizeMission(auth.authorized ? "COMPLETED" : "REJECTED");

    const summary = {
      ok: true,
      missionId: mission.missionId,
      targetScope,
      objective,
      status: mission.status,
      registryStats: this.registry.stats(),
      selectedAgents: team.map((a) => ({ id: a.id, code: a.code, name: a.name, capabilities: a.capabilities })),
      capabilityGrants: activeGrants,
      parliament: { risk, policy, quorum: quorumResult, decision: auth },
      sliceReportPath: sliceOut.reportPath,
      blackBoxDigest: finalized.missionDigest,
      integrity: finalized.integrity
    };

    fs.writeFileSync(path.join(MISSIONS_DIR, `${mission.missionId}.json`), JSON.stringify(summary, null, 2));
    return summary;
  }
}

module.exports = MissionOrchestrator;
