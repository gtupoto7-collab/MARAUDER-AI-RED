const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const TARGET_FILE = path.join(process.cwd(), "data", "agent-army", "agents.json");

function loadList(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.agents)) return raw.agents;
  throw new Error("UNSUPPORTED_FORMAT");
}

function main() {
  const list = loadList(TARGET_FILE);
  const ids = new Set();
  const names = new Set();
  let missingHash = 0;
  let invalidHash = 0;

  for (const ag of list) {
    const id = String(ag.id || "");
    const name = String(ag.name || ag.callsign || "");
    if (!id || ids.has(id)) {
      throw new Error(`INVALID_OR_DUPLICATE_ID:${id}`);
    }
    if (!name || names.has(name)) {
      throw new Error(`INVALID_OR_DUPLICATE_NAME:${name}`);
    }
    ids.add(id);
    names.add(name);

    if (!ag.profileHash) {
      missingHash += 1;
      continue;
    }

    const { profileHash, ...rest } = ag;
    const expected = crypto
      .createHash("sha256")
      .update(JSON.stringify(rest))
      .digest("hex");

    if (profileHash !== expected) {
      invalidHash += 1;
    }
  }

  console.log({
    FILE: TARGET_FILE,
    TOTAL_RECORDS: list.length,
    UNIQUE_IDS: ids.size,
    UNIQUE_NAMES: names.size,
    DUPLICATE_IDS: list.length - ids.size,
    DUPLICATE_NAMES: list.length - names.size,
    MISSING_HASH: missingHash,
    INVALID_HASH: invalidHash,
    OFFICIAL_VERIFICATION: invalidHash === 0 ? "PASSED" : "HASH_MISMATCH_DETECTED"
  });

  if (invalidHash > 0) {
    process.exitCode = 1;
  }
}

main();
