class EventPipeline {
  constructor({ dedupWindowMs = 15000, hotLimit = 500 } = {}) {
    this.dedupWindowMs = Number(dedupWindowMs) || 15000;
    this.hotLimit = Math.max(50, Number(hotLimit) || 500);
    this.seen = new Map();
    this.hot = [];
    this.warm = [];
    this.coldCount = 0;
  }

  filter(events = []) {
    return (events || []).filter((ev) => {
      if (!ev || !ev.source || !ev.type) return false;
      const sev = String(ev.severity || "info").toLowerCase();
      return sev !== "debug" && sev !== "trace";
    });
  }

  normalize(events = []) {
    return events.map((ev) => ({
      ts: ev.ts ? new Date(ev.ts).toISOString() : new Date().toISOString(),
      source: String(ev.source).trim(),
      type: String(ev.type).trim().toLowerCase(),
      asset: String(ev.asset || "unassigned").trim(),
      severity: String(ev.severity || "info").toLowerCase(),
      signature: String(ev.signature || ev.type).trim()
    }));
  }

  deduplicate(events = []) {
    const out = [];
    const now = Date.now();
    for (const ev of events) {
      const key = `${ev.source}|${ev.type}|${ev.asset}|${ev.signature}`;
      const last = this.seen.get(key);
      if (last && now - last.ts < this.dedupWindowMs) {
        last.count += 1;
        last.ts = now;
        continue;
      }
      this.seen.set(key, { ts: now, count: 1 });
      out.push({ ...ev, dedupKey: key });
    }
    return out;
  }

  correlate(events = []) {
    const byAsset = new Map();
    for (const ev of events) {
      const arr = byAsset.get(ev.asset) || [];
      arr.push(ev);
      byAsset.set(ev.asset, arr);
    }
    return events.map((ev) => ({
      ...ev,
      assetEventCount: (byAsset.get(ev.asset) || []).length
    }));
  }

  score(events = []) {
    const baseMap = { info: 15, low: 30, medium: 60, high: 85, critical: 98 };
    return events.map((ev) => {
      const base = baseMap[ev.severity] ?? 25;
      const boost = Math.min((ev.assetEventCount - 1) * 7, 15);
      return { ...ev, priorityScore: Math.min(base + boost, 100) };
    });
  }

  routeStorage(scored = []) {
    for (const item of scored) {
      if (item.priorityScore >= 60) {
        this.hot.push(item);
        if (this.hot.length > this.hotLimit) {
          this.warm.push(this.hot.shift());
        }
      } else if (item.priorityScore >= 25) {
        this.warm.push(item);
      } else {
        this.coldCount += 1;
      }
    }
  }

  process(rawEvents = []) {
    const f = this.filter(rawEvents);
    const n = this.normalize(f);
    const d = this.deduplicate(n);
    const c = this.correlate(d);
    const s = this.score(c);
    this.routeStorage(s);
    return {
      inputCount: (rawEvents || []).length,
      outputCount: s.length,
      items: s,
      tiers: { hot: this.hot.length, warm: this.warm.length, coldArchived: this.coldCount }
    };
  }
}

module.exports = { EventPipeline };
