"use strict";

const { SensorBusFusionEngine } = require("../anti-drone/sensor-bus-fusion");

const BLUE_AGENTS = [
  "BLUE-RADAR",
  "BLUE-VISION",
  "BLUE-FUSION",
  "BLUE-TRACKER",
  "BLUE-THREAT",
  "BLUE-PREDICT",
  "BLUE-COMMAND",
  "BLUE-FORENSICS"
];

class BlueForceEngine {
  constructor(fusionEngine = null) {
    this.agents = BLUE_AGENTS.slice();
    this.fusion = fusionEngine || new SensorBusFusionEngine();
    this.anomalies = [];
    this.outages = [];
  }

  processScenarioStep(step = {}) {
    const events = [];

    if (step.observation) {
      const res1 = this.fusion.ingestObservation(step.observation);
      if (res1.ok) {
        events.push({
          t: step.t,
          agent: "BLUE-RADAR",
          trackId: res1.track.trackId,
          corroborated: res1.track.corroborated,
          threatScore: res1.track.threatScore
        });
      }
    }

    if (step.corroborateWith) {
      const res2 = this.fusion.ingestObservation(step.corroborateWith);
      if (res2.ok) {
        events.push({
          t: step.t,
          agent: "BLUE-FUSION",
          trackId: res2.track.trackId,
          corroborated: res2.track.corroborated,
          classification: res2.track.classification,
          threatScore: res2.track.threatScore,
          explainability: res2.track.explainability
        });
      }
    }

    if (step.anomaly) {
      const delta = Math.abs(Number(step.anomaly.reportedSpeedKmh || 0) - Number(step.anomaly.corroboratedSpeedKmh || 0));
      const record = {
        t: step.t,
        trackId: step.anomaly.trackId,
        type: step.anomaly.type,
        speedDeltaKmh: delta,
        reliabilityPenalty: delta > 50 ? "HIGH_CONFLICT_FLAGGED" : "MINOR_VARIANCE"
      };
      this.anomalies.push(record);
      events.push({
        t: step.t,
        agent: "BLUE-VISION",
        anomaly: record
      });
    }

    if (step.sensorOutage) {
      this.outages.push({ t: step.t, ...step.sensorOutage });
      events.push({
        t: step.t,
        agent: "BLUE-TRACKER",
        outage: step.sensorOutage,
        fallback: "MAINTAIN_KALMAN_EXTRAPOLATION_AND_REWEIGHT_ACTIVE_SENSORS"
      });
    }

    return events;
  }

  assessRisk(assetsProtected = []) {
    const tracks = Array.from(this.fusion.tracks.values()).map((t) => ({
      ...t,
      sensors: Array.from(t.sensors)
    }));

    const corroboratedCount = tracks.filter((t) => t.corroborated).length;
    const uncorroboratedTracks = tracks.filter((t) => !t.corroborated).length;
    const maxScore = tracks.reduce((m, t) => Math.max(m, t.threatScore || 0), 0);

    const baseRisk = Math.min(
      100,
      Math.round(maxScore * 0.65 + this.anomalies.length * 10 + this.outages.length * 8)
    );

    const bayesianPosteriorRisk = Number(
      Math.min(0.99, Math.max(0.05, (baseRisk / 100) * 0.85 + (corroboratedCount > 0 ? 0.12 : 0.03))).toFixed(3)
    );

    const assetPriorities = (assetsProtected.length ? assetsProtected : ["PORT_ZONE", "CRITICAL_INFRASTRUCTURE"]).map(
      (asset, idx) => ({
        asset,
        priority: idx === 0 ? "P1_CRITICAL" : idx === 1 ? "P1_HIGH" : "P2_ELEVATED",
        riskScore: Math.max(15, baseRisk - idx * 6)
      })
    );

    return {
      totalTracks: tracks.length,
      corroboratedTracks: corroboratedCount,
      uncorroboratedTracks,
      anomaliesDetected: this.anomalies.length,
      sensorOutages: this.outages.length,
      riskScore: baseRisk,
      bayesianPosteriorRisk,
      assetPriorities,
      recommendedOperatorActions: [
        "Verify corroborated hostile candidates on EO/IR pan-tilt and confirm sensor health",
        "Flag conflicting telemetry track for manual operator review before escalating alert level",
        "Keep kinetic or RF/electronic mitigation strictly gated behind human command & authorized external interface"
      ],
      automaticWeaponsRelease: false
    };
  }
}

module.exports = { BlueForceEngine, BLUE_AGENTS };
