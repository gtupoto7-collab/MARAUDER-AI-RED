const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const EVID_DIR = path.join(__dirname, "..", "..", "data", "evidence");
const LOG_FILE = path.join(EVID_DIR, "findings-and-runs.jsonl");

class EvidenceStore {
  constructor() {
    fs.mkdirSync(EVID_DIR, { recursive: true });
    if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, "");
  }

  recordExecution(record) {
    const id = "EVD-" + crypto.randomBytes(4).toString("hex").toUpperCase();
    const entry = {
      id,
      timestamp: new Date().toISOString(),
      ...record
    };
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
    return entry;
  }

  listRecent(limit = 20) {
    const lines = fs.readFileSync(LOG_FILE, "utf8").trim().split("\n").filter(Boolean);
    return lines.slice(-Number(limit)).map((l) => JSON.parse(l));
  }
}

module.exports = EvidenceStore;
