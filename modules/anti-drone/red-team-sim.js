"use strict";

const crypto = require("crypto");

class RedTeamDefenseSimulator {
  constructor(defenseEngine) {
    this.engine = defenseEngine;
    this.runs = [];
  }

  runScenario(name = "BLACKSEA_SWARM_INTRUSION") {
    const scenarios = {
      BLACKSEA_SWARM_INTRUSION: [
        { trackId: "BS-UAS-01", freqMhz: 5800, rssiDbm: -45, distanceM: 180, speedKmh: 78, altitudeM: 55, swarmCount: 4, rfHopping: true },
        { trackId: "BS-UAS-02", freqMhz: 2450, rssiDbm: -49, distanceM: 210, speedKmh: 72, altitudeM: 65, swarmCount: 4, rfHopping: true }
      ],
      COASTAL_RECON_PROBE: [
        { trackId: "CR-UAS-09", freqMhz: 915, rssiDbm: -61, distanceM: 460, speedKmh: 48, altitudeM: 120, swarmCount: 1, rfHopping: true }
      ]
    };

    const frames = scenarios[name] || scenarios.BLACKSEA_SWARM_INTRUSION;
    const ingested = frames.map((f) => this.engine.ingestSensorFrame(f));
    const deniedCheck = this.engine.authorizeAction(
      ingested[0].id,
      ingested[0].recommendedCountermeasure,
      "AUTO-SIM"
    );

    const runRecord = {
      runId: `SIM-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
      scenario: name,
      timestamp: new Date().toISOString(),
      tracksEvaluated: ingested.length,
      highestThreat: ingested.reduce((max, t) => Math.max(max, t.threatScore), 0),
      policyGateEnforced: deniedCheck.ok === false,
      gateReason: deniedCheck.reason || null
    };

    this.runs.push(runRecord);
    return runRecord;
  }
}

module.exports = { RedTeamDefenseSimulator };
