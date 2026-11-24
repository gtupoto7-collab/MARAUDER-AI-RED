class KillSwitch {
  constructor() {
    this.engaged = false;
    this.reason = null;
    this.engagedAt = null;
  }

  engage(reason = "Manual kill switch engaged") {
    this.engaged = true;
    this.reason = String(reason);
    this.engagedAt = new Date().toISOString();
    return this.status();
  }

  disengage() {
    this.engaged = false;
    this.reason = null;
    this.engagedAt = null;
    return this.status();
  }

  status() {
    return { engaged: this.engaged, reason: this.reason, engagedAt: this.engagedAt };
  }
}

module.exports = { KillSwitch };
