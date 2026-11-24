class HealthManager {
  constructor() {
    this.components = new Map();
  }

  recordSuccess(name) {
    const key = String(name);
    this.components.set(key, {
      name: key,
      health: "healthy",
      failures: 0,
      isolated: false,
      updatedAt: new Date().toISOString()
    });
  }

  recordFailure(name, errorMessage = "", isolateThreshold = 3) {
    const key = String(name);
    const prev = this.components.get(key) || { name: key, failures: 0, health: "healthy", isolated: false };
    const failures = prev.failures + 1;
    const isolated = failures >= isolateThreshold;
    const state = {
      name: key,
      health: isolated ? "isolated" : "degraded",
      failures,
      isolated,
      lastError: String(errorMessage),
      updatedAt: new Date().toISOString()
    };
    this.components.set(key, state);
    return state;
  }

  recover(name) {
    const key = String(name);
    const state = {
      name: key,
      health: "healthy",
      failures: 0,
      isolated: false,
      recoveredAt: new Date().toISOString()
    };
    this.components.set(key, state);
    return state;
  }

  isIsolated(name) {
    const cur = this.components.get(String(name));
    return Boolean(cur && cur.isolated);
  }
}

module.exports = { HealthManager };
