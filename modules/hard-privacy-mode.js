"use strict";

const FORBIDDEN_PRIVACY_KEYS = new Set([
  "ip",
  "clientIp",
  "remoteAddress",
  "gps",
  "lat",
  "lng",
  "latitude",
  "longitude",
  "location",
  "exif",
  "deviceId",
  "permanentDeviceId",
  "fingerprint",
  "analytics",
  "tracker"
]);

function createHardPrivacyPolicy(overrides = {}) {
  return {
    mode: "HARD_PRIVACY",
    storeIpInAppDb: false,
    allowLocationPermission: false,
    allowGpsInMetadata: false,
    stripExifBeforeUpload: true,
    allowThirdPartyAnalytics: false,
    requireCiphertextOnly: true,
    torTransportOptional: true,
    appLockHint: "PIN_OR_BIOMETRIC_RECOMMENDED",
    ...overrides
  };
}

function scrubUntrustedPayload(input, policy = createHardPrivacyPolicy()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { clean: {}, strippedKeys: [] };
  }
  const strippedKeys = [];
  const clean = {};

  for (const [k, v] of Object.entries(input)) {
    if (FORBIDDEN_PRIVACY_KEYS.has(k)) {
      strippedKeys.push(k);
      continue;
    }
    if (policy.requireCiphertextOnly && k === "plaintext") {
      strippedKeys.push(k);
      continue;
    }
    clean[k] = v;
  }

  return { clean, strippedKeys };
}

function buildHardPrivacySnapshot(extra = {}) {
  const policy = createHardPrivacyPolicy(extra.policy || {});
  return {
    mode: policy.mode,
    controls: {
      ipNotStoredInAppDb: !policy.storeIpInAppDb,
      noLocationPermissionOrGps: !policy.allowLocationPermission && !policy.allowGpsInMetadata,
      exifStrippingEnabled: Boolean(policy.stripExifBeforeUpload),
      noThirdPartyTrackers: !policy.allowThirdPartyAnalytics,
      ciphertextOnly: Boolean(policy.requireCiphertextOnly),
      optionalTorOrVpn: Boolean(policy.torTransportOptional)
    },
    limits: {
      no100PercentAnonymityGuarantee: true,
      compromisedDeviceRisk: "If endpoint OS/device has malware or is compromised, pre/post-encryption plaintext can still be exposed."
    },
    ...extra
  };
}

module.exports = {
  FORBIDDEN_PRIVACY_KEYS,
  createHardPrivacyPolicy,
  scrubUntrustedPayload,
  buildHardPrivacySnapshot
};
