"use strict";

const crypto = require("crypto");

const SENSOR_TYPES = new Set(["RADAR", "RF", "EO_IR", "ACOUSTIC", "AIS_ADS_B"]);

class SensorBusFusionEngine {
  constructor() {
    this.tracks = new Map();
    this.evidenceLog = [];
  }

  ingestObservation(obs = {}) {
    const sensor = String(obs.sensor || "RADAR").toUpperCase();
    if (!SENSOR_TYPES.has(sensor)) {
      return { ok: false, reason: "UNSUPPORTED_SENSOR_TYPE", sensor };
    }

    const trackId = String(obs.trackId || `TRK-${crypto.randomBytes(3).toString("hex").toUpperCase()}`);
    const knownTraffic = Boolean(obs.knownTraffic || sensor === "AIS_ADS_B");
    const confidence = Math.max(0, Math.min(1, Number(obs.confidence ?? 0.75)));
    const distanceM = Number(obs.distanceM ?? 500);
    const speedKmh = Number(obs.speedKmh ?? 55);
    const altitudeM = Number(obs.altitudeM ?? 90);
    const zone = String(obs.zone || "BLACK_SEA_COAST");

    const existing = this.tracks.get(trackId) || {
      trackId,
      zone,
      sensors: new Set(),
      observations: [],
      knownTraffic: false,
      trajectory: { distanceM, speedKmh, altitudeM },
      threatScore: 0,
      classification: "UNCLASSIFIED",
      corroborated: false,
      explainability: []
    };

    existing.sensors.add(sensor);
    existing.knownTraffic = existing.knownTraffic || knownTraffic;
    existing.trajectory = { distanceM, speedKmh, altitudeM };
    existing.observations.push({
      sensor,
      confidence,
      distanceM,
      speedKmh,
      altitudeM,
      ts: new Date().toISOString()
    });

    existing.corroborated = existing.sensors.size >= 2 && !existing.knownTraffic;

    let score = Math.round(confidence * 45);
    if (existing.sensors.size >= 2) score += 20;
    if (distanceM < 400) score += 15;
    if (speedKmh > 60) score += 10;
    if (existing.knownTraffic) score = Math.max(5, score - 60);
    score = Math.min(100, Math.max(0, score));

    existing.threatScore = score;
    existing.classification = existing.knownTraffic
      ? "KNOWN-TRANSPONDER-TRAFFIC"
      : score >= 75 && existing.corroborated
      ? "CONFIRMED-HOSTILE-UAS-CANDIDATE"
      : score >= 50
      ? "ELEVATED-UNVERIFIED-TRACK"
      : "LOW-PRIORITY-DETECTION";

    existing.explainability = [
      `Sensors: ${Array.from(existing.sensors).join(", ")}`,
      `Corroborated (>=2 sensors, non-AIS/ADS-B): ${existing.corroborated}`,
      `Trajectory: dist=${distanceM}m, speed=${speedKmh}km/h, alt=${altitudeM}m`,
      `Mitigation mode: DETECT_AND_ALERT_ONLY (requires authorized external interface)`
    ];

    const evidenceId = `EVD-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const hash = crypto
      .createHash("sha256")
      .update(`${evidenceId}|${trackId}|${sensor}|${score}|${existing.classification}`)
      .digest("hex");

    const evidenceRecord = {
      evidenceId,
      trackId,
      sensor,
      zone,
      threatScore: score,
      classification: existing.classification,
      corroborated: existing.corroborated,
      hash,
      recordedAt: new Date().toISOString()
    };

    this.tracks.set(trackId, existing);
    this.evidenceLog.push(evidenceRecord);

    return {
      ok: true,
      track: {
        ...existing,
        sensors: Array.from(existing.sensors)
      },
      evidence: evidenceRecord
    };
  }
}

module.exports = { SensorBusFusionEngine, SENSOR_TYPES };
