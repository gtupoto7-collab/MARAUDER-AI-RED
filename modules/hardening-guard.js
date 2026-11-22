"use strict";

function createRateLimiter({ windowMs = 60_000, maxRequests = 60 } = {}) {
  const buckets = new Map();

  function check(bucketKey = "global", now = Date.now()) {
    const key = String(bucketKey || "global");
    let entry = buckets.get(key);
    if (!entry || now - entry.windowStart >= windowMs) {
      entry = { windowStart: now, count: 0 };
      buckets.set(key, entry);
    }
    entry.count += 1;
    const allowed = entry.count <= maxRequests;
    const retryAfterSec = Math.max(1, Math.ceil((entry.windowStart + windowMs - now) / 1000));
    return {
      allowed,
      remaining: Math.max(0, maxRequests - entry.count),
      retryAfterSec
    };
  }

  function reset() {
    buckets.clear();
  }

  return { check, reset };
}

function applySecurityHeaders(res, { noStore = true } = {}) {
  if (!res || typeof res.setHeader !== "function") return;
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (noStore) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
  }
}

function validateJsonPayloadSize(bodyJson, maxBytes = 64 * 1024) {
  if (bodyJson === undefined || bodyJson === null) return { ok: true, bytes: 0 };
  const raw = typeof bodyJson === "string" ? bodyJson : JSON.stringify(bodyJson);
  const bytes = Buffer.byteLength(raw, "utf8");
  if (bytes > maxBytes) {
    return { ok: false, bytes, maxBytes, error: "PAYLOAD_TOO_LARGE" };
  }
  return { ok: true, bytes, maxBytes };
}

module.exports = {
  createRateLimiter,
  applySecurityHeaders,
  validateJsonPayloadSize
};
