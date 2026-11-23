const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const keysFile = path.join(__dirname, "..", "data", "issued-keys.json");

function loadKeys() {
  if (!fs.existsSync(keysFile)) return [];
  try {
    return JSON.parse(fs.readFileSync(keysFile, "utf8"));
  } catch {
    return [];
  }
}

function saveKeys(list) {
  fs.mkdirSync(path.dirname(keysFile), { recursive: true });
  fs.writeFileSync(keysFile, JSON.stringify(list, null, 2));
}

function issueKeyOnPayment(paymentRef = "MANUAL-TEST", tier = "FULL-CONSOLE-TOR-APP") {
  const code = "MRD-" + crypto.randomBytes(4).toString("hex").toUpperCase() + "-" + crypto.randomBytes(2).toString("hex").toUpperCase();
  const list = loadKeys();
  const record = {
    key: code,
    paymentRef: String(paymentRef),
    tier,
    createdAt: new Date().toISOString(),
    active: true
  };
  list.push(record);
  saveKeys(list);
  return record;
}

function verifyUnlockKey(code) {
  const clean = String(code || "").trim().toUpperCase();
  if (!clean) return { valid: false };
  const list = loadKeys();
  const found = list.find((item) => item.active && item.key.toUpperCase() === clean);
  return { valid: Boolean(found), record: found || null };
}

module.exports = { issueKeyOnPayment, verifyUnlockKey };
