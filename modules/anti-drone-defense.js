"use strict";

const crypto = require("crypto");

const ZONES = {
  BLACK_SEA_COAST: {
    label: "Черно море и крайбрежен периметър",
    priorityBoost: 15,
    civilAlertChannel: "MARITIME-COASTAL-ALERT"
  },
  BORDER_MOUNTAIN: {
    label: "Граничен и планински пояс",
    priorityBoost: 10,
    civilAlertChannel: "BORDER-AIRSPACE-ALERT"
  },
  CRITICAL_INFRA_CIVIL: {
    label: "Критична инфраструктура и население",
    priorityBoost: 20,
    civilAlertChannel: "BG-ALERT-CIVIL-PROTECTION"
  },
  NATIONAL_INTERIOR: {
    label: "Вътрешност на страната",
    priorityBoost: 5,
    civilAlertChannel: "NATIONAL-DEFENSE-GRID"
  }
};

class AntiDroneDefenseEngine {
  constructor(opts = {}) {
    this.unitName = opts.unitName || "MARAUDER-AEGIS-BG-NATIONAL-SHIELD";
    this.classification = "NATIONAL-DEFENSIVE-COUNTER-UAS-TELEMETRY";
    this.zones = ZONES;
    this.tracks = new Map();
    this.auditLog = [];
    this.killSwitchEngaged = false;
  }

  setKillSwitch(engaged, operatorId = "ADMIRALERROR") {
    this.killSwitchEngaged = Boolean(engaged);
    this.recordAudit("KILL_SWITCH_UPDATED", { engaged: this.killSwitchEngaged, operatorId });
    return { killSwitchEngaged: this.killSwitchEngaged };
  }

  ingestSensorFrame(frame = {}) {
    const id = String(frame.trackId || frame.id || `UAS-${crypto.randomBytes(3).toString("hex").toUpperCase()}`);
    const zoneKey = ZONES[frame.zone] ? frame.zone : "NATIONAL_INTERIOR";
    const zoneMeta = ZONES[zoneKey];
    const freqMhz = Number(frame.freqMhz || 2450);
    const rssiDbm = Number(frame.rssiDbm ?? -52);
    const distanceM = Number(frame.distanceM ?? 350);
    const speedKmh = Number(frame.speedKmh ?? 68);
    const altitudeM = Number(frame.altitudeM ?? 85);
    const swarmCount = Number(frame.swarmCount ?? 1);
    const rfHopping = Boolean(frame.rfHopping ?? (freqMhz === 2450 || freqMhz === 5800 || freqMhz === 915));

    let threatScore = zoneMeta.priorityBoost;
    if (distanceM < 500) threatScore += 30;
    if (distanceM < 200) threatScore += 25;
    if (rssiDbm > -55) threatScore += 15;
    if (rfHopping) threatScore += 10;
    if (swarmCount > 1) threatScore += Math.min(20, swarmCount * 5);
    threatScore = Math.min(100, threatScore);

    const threatLevel =
      threatScore >= 80 ? "CRITICAL-SWARM-LOCK" :
      threatScore >= 55 ? "HIGH-INTRUSION" :
      threatScore >= 30 ? "ELEVATED-RECON" : "LOW-MONITOR";

    const record = {
      id,
      timestamp: new Date().toISOString(),
      zone: zoneKey,
      zoneLabel: zoneMeta.label,
      civilAlertChannel: zoneMeta.civilAlertChannel,
      freqMhz,
      rssiDbm,
      distanceM,
      speedKmh,
      altitudeM,
      swarmCount,
      rfHopping,
      threatScore,
      threatLevel,
      recommendedCountermeasure: this.selectCountermeasure(threatScore, rfHopping, swarmCount, zoneKey)
    };

    this.tracks.set(id, record);
    this.recordAudit("SENSOR_FRAME_INGESTED", record);
    return record;
  }

  selectCountermeasure(score, rfHopping, swarmCount, zoneKey) {
    if (score < 30) return "PASSIVE-RF-OPTICAL-TRACKING";
    if (zoneKey === "CRITICAL_INFRA_CIVIL" && score >= 75) return "CIVIL-ALERT-AND-ISOLATED-INTERDICT-PLAN";
    if (swarmCount > 1) return "MULTI-BAND-GNSS-CONTROL-DENIAL-QUEUE";
    if (rfHopping) return "WIDEBAND-FHSS-SUPPRESSION-PLAN";
    return "DIRECTIONAL-LINK-INTERDICT-PLAN";
  }

  authorizeAction(trackId, actionType, operatorId = "ADMIRALERROR", approvalToken = null) {
    if (this.killSwitchEngaged) {
      return { ok: false, reason: "KILL_SWITCH_ENGAGED", trackId };
    }
    const track = this.tracks.get(trackId);
    if (!track) {
      return { ok: false, reason: "UNKNOWN_TRACK_ID", trackId };
    }
    const allowed = [
      "PASSIVE-RF-OPTICAL-TRACKING",
      "CIVIL-ALERT-AND-ISOLATED-INTERDICT-PLAN",
      "WIDEBAND-FHSS-SUPPRESSION-PLAN",
      "DIRECTIONAL-LINK-INTERDICT-PLAN",
      "MULTI-BAND-GNSS-CONTROL-DENIAL-QUEUE"
    ];
    if (!allowed.includes(actionType)) {
      return { ok: false, reason: "UNSUPPORTED_COUNTERMEASURE", actionType };
    }
    if (track.threatScore >= 80 && !approvalToken) {
      return { ok: false, reason: "CRITICAL_THREAT_REQUIRES_EXPLICIT_TOKEN", trackId, threatScore: track.threatScore };
    }
    const decision = {
      ok: true,
      orderId: `ORD-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      trackId,
      zone: track.zone,
      actionType,
      operatorId,
      authorizedAt: new Date().toISOString(),
      mode: "CONTROLLED-SIMULATION-AND-POLICY-GATE"
    };
    this.recordAudit("COUNTERMEASURE_AUTHORIZED", decision);
    return decision;
  }

  recordAudit(event, payload) {
    const prevHash = this.auditLog.length ? this.auditLog[this.auditLog.length - 1].hash : "GENESIS";
    const digest = crypto.createHash("sha256").update(`${prevHash}|${event}|${JSON.stringify(payload)}`).digest("hex");
    this.auditLog.push({ event, payload, prevHash, hash: digest, ts: new Date().toISOString() });
  }

  getStatus() {
    const zoneBreakdown = {};
    for (const key of Object.keys(this.zones)) {
      zoneBreakdown[key] = {
        label: this.zones[key].label,
        tracks: Array.from(this.tracks.values()).filter((t) => t.zone === key).length
      };
    }
    return {
      unitName: this.unitName,
      classification: this.classification,
      killSwitchEngaged: this.killSwitchEngaged,
      zones: zoneBreakdown,
      activeTracks: Array.from(this.tracks.values()),
      auditCount: this.auditLog.length,
      chainTail: this.auditLog.length ? this.auditLog[this.auditLog.length - 1].hash : "GENESIS"
    };
  }
}

module.exports = { AntiDroneDefenseEngine, ZONES };
