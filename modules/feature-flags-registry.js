"use strict";

const DEFAULT_FEATURES = {
  security: {
    twoPasswordUnlock: true,
    biometricUnlock: true,
    deleteChat: true,
    encryptedFiles: true
  },
  secretChat: {
    rooms: true,
    qrPairing: true,
    devicePairing: true,
    groupChat: true
  },
  payments: {
    copper: true,
    silver: true,
    gold: true,
    annual: true
  },
  network: {
    vpnStatus: true,
    torStatus: true,
    connectionCheck: true
  }
};

function isFeatureEnabled(section, feature, featuresObj = DEFAULT_FEATURES) {
  if (!featuresObj || typeof featuresObj !== "object") return false;
  const sec = featuresObj[section];
  if (!sec || typeof sec !== "object") return false;
  return Boolean(sec[feature]);
}

module.exports = {
  DEFAULT_FEATURES,
  isFeatureEnabled
};
