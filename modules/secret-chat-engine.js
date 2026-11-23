const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const storePath = path.join(__dirname, "..", "data", "secret-rooms.json");
const TTL_MS = 3 * 60 * 1000;

function loadStore() {
  if (!fs.existsSync(storePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(storePath, "utf8"));
  } catch {
    return {};
  }
}

function saveStore(data) {
  fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
}

function generateCredentials() {
  const key = "MRD-" + crypto.randomBytes(6).toString("hex").toUpperCase();
  const password = crypto.randomBytes(8).toString("base64url");
  return { key, password, ttlSeconds: 180 };
}

function deriveAesKey(key, password) {
  return crypto.scryptSync(`${key}:${password}`, "marauder-red-salt", 32);
}

function encryptMessage(plainText, key, password) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveAesKey(key, password), iv);
  const enc = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

function decryptMessage(payload, key, password) {
  const [ivHex, tagHex, encHex] = String(payload).split(":");
  if (!ivHex || !tagHex || !encHex) throw new Error("Invalid encrypted payload");
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveAesKey(key, password), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]).toString("utf8");
}

function postSecretMessage(roomKey, password, sender, text) {
  const now = Date.now();
  const store = purgeExpired(loadStore(), now);
  if (!store[roomKey]) store[roomKey] = [];
  store[roomKey].push({
    id: crypto.randomUUID(),
    sender: sender || "OPERATOR",
    cipherText: encryptMessage(text, roomKey, password),
    createdAt: now,
    expiresAt: now + TTL_MS
  });
  saveStore(store);
  return { ok: true, expiresInSeconds: 180 };
}

function purgeExpired(store, now = Date.now()) {
  for (const roomKey of Object.keys(store)) {
    store[roomKey] = store[roomKey].filter((m) => m.expiresAt > now);
    if (store[roomKey].length === 0) delete store[roomKey];
  }
  return store;
}

function readSecretMessages(roomKey, password) {
  const now = Date.now();
  const store = purgeExpired(loadStore(), now);
  saveStore(store);
  const list = store[roomKey] || [];
  return list.map((m) => ({
    id: m.id,
    sender: m.sender,
    text: decryptMessage(m.cipherText, roomKey, password),
    secondsLeft: Math.max(0, Math.ceil((m.expiresAt - now) / 1000))
  }));
}

module.exports = {
  generateCredentials,
  encryptMessage,
  decryptMessage,
  postSecretMessage,
  readSecretMessages,
  purgeExpired
};
