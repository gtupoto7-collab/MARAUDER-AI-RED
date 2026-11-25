"use strict";

const RED_AGENTS = [
  "RED-STRATEGIST",
  "RED-RECON",
  "RED-DECEPTION",
  "RED-SWARM",
  "RED-ADAPTIVE",
  "RED-ANALYST"
];

class RedForceEngine {
  constructor(seed = 1337) {
    this.agents = RED_AGENTS.slice();
    this.seed = Number(seed) || 1337;
  }

  _rand(step = 0) {
    const x = Math.sin(this.seed * 9973 + step * 7919) * 10000;
    return x - Math.floor(x);
  }

  buildBlackSeaShieldScenario(options = {}) {
    const name = String(options.name || "BLACK SEA SHIELD");
    const swarmCount = Math.max(2, Math.min(12, Number(options.swarmCount || 4)));
    const dropSensor = options.dropSensor !== false;
    const spoofTelemetry = options.spoofTelemetry !== false;

    const timeline = [
      {
        t: "00:00",
        agent: "RED-STRATEGIST",
        mode: "SIMULATION_ONLY",
        event: `Start ${name} against coastal port, critical infra, airspace & comms`
      }
    ];

    for (let i = 1; i <= swarmCount; i++) {
      const trackId = `SIM-BS-${String(i).padStart(2, "0")}`;
      const dist = Math.round(280 + i * 110 + this._rand(i) * 80);
      const speed = Math.round(58 + i * 7 + this._rand(i + 10) * 15);
      const alt = Math.round(35 + i * 18);
      timeline.push({
        t: i === 1 ? "00:15" : "01:00",
        agent: "RED-SWARM",
        mode: "SIMULATION_ONLY",
        observation: {
          trackId,
          sensor: i % 2 === 1 ? "RADAR" : "EO_IR",
          confidence: Number((0.72 + this._rand(i + 20) * 0.22).toFixed(2)),
          distanceM: dist,
          speedKmh: speed,
          altitudeM: alt,
          zone: "BLACK_SEA_COAST",
          knownTraffic: false
        },
        corroborateWith: {
          trackId,
          sensor: i % 2 === 1 ? "EO_IR" : "RF",
          confidence: Number((0.76 + this._rand(i + 30) * 0.2).toFixed(2)),
          distanceM: Math.max(120, dist - 20),
          speedKmh: speed + 2,
          altitudeM: Math.max(15, alt - 4),
          zone: "BLACK_SEA_COAST",
          knownTraffic: false
        }
      });
    }

    if (spoofTelemetry) {
      timeline.push({
        t: "00:25",
        agent: "RED-DECEPTION",
        mode: "SIMULATION_ONLY",
        anomaly: {
          trackId: "SIM-BS-01",
          type: "CONFLICTING_TELEMETRY_TEST",
          reportedSpeedKmh: 210,
          corroboratedSpeedKmh: 62,
          note: "Simulated conflicting speed telemetry to test fusion consistency"
        }
      });
    }

    if (dropSensor) {
      timeline.push({
        t: "00:40",
        agent: "RED-RECON",
        mode: "SIMULATION_ONLY",
        sensorOutage: {
          sensor: "EO_IR",
          durationSec: 25,
          note: "Simulated temporary sensor dropout to test fallback & uncertainty"
        }
      });
    }

    timeline.push({
      t: "01:20",
      agent: "RED-ADAPTIVE",
      mode: "SIMULATION_ONLY",
      adaptation: "Shifted approach vector toward low-altitude coastal corridor"
    });

    return {
      scenarioName: name,
      simulationOnly: true,
      assetsProtected: [
        "PORT_ZONE",
        "CRITICAL_INFRASTRUCTURE",
        "AIR_PERIMETER",
        "COMMS_INFRASTRUCTURE"
      ],
      timeline
    };
  }

  analyzeWeaknesses(blueReport = {}) {
    const gaps = [];
    if (blueReport.anomaliesDetected > 0) {
      gaps.push("Conflicting telemetry injected on track SIM-BS-01 requires cross-sensor velocity gating");
    }
    if (blueReport.sensorOutages > 0) {
      gaps.push("Temporary sensor loss increases track uncertainty and requires higher acoustic/radar weighting");
    }
    if ((blueReport.uncorroboratedTracks || 0) > 0) {
      gaps.push("Single-sensor tracks remain uncorroborated until secondary confirmation arrives");
    }
    if (gaps.length === 0) {
      gaps.push("Baseline blue defense held under simulated red pressure");
    }
    return {
      analyst: "RED-ANALYST",
      gaps,
      recommendedProbe: "ADAPTIVE_LOW_ALTITUDE_CORRIDOR_TEST"
    };
  }
}

module.exports = { RedForceEngine, RED_AGENTS };
