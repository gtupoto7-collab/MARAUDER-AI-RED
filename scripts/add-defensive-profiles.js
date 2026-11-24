const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const TARGET_FILE = path.join(process.cwd(), "data", "agent-army", "agents.json");
const BATCH_SIZE = Number(process.env.BATCH_COUNT || 500);

const PROFILES = [
  { code: "CYBER-DEF", role: "SOC Division", desc: "Анализ на защитни политики, логове и устойчивост на системата" },
  { code: "SCOPE-AUDIT", role: "Verification", desc: "Проверка на обхват, права и допустими граници на тестове" },
  { code: "MATH-DECOMP", role: "Code Security", desc: "Структурен и формален анализ на алгоритми, състояния и инварианти" },
  { code: "HARDEN-LEAD", role: "Integrity & Audit", desc: "Заздравяване на конфигурации, заглавия и ключови модули" }
];

function loadDoc(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (Array.isArray(raw)) return { mode: "array", root: raw, list: raw };
  if (raw && Array.isArray(raw.agents)) return { mode: "object", root: raw, list: raw.agents };
  throw new Error("UNSUPPORTED_AGENTS_JSON_STRUCTURE");
}

function saveDoc(doc, filePath) {
  if (doc.mode === "array") {
    fs.writeFileSync(filePath, JSON.stringify(doc.root, null, 2) + "\n");
  } else {
    doc.root.count = doc.list.length;
    doc.root.updatedAt = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(doc.root, null, 2) + "\n");
  }
}

function parseNum(idStr) {
  const m = /^AI-AGT-(\d+)$/.exec(String(idStr || ""));
  return m ? parseInt(m[1], 10) : 0;
}

function main() {
  const doc = loadDoc(TARGET_FILE);
  const ids = new Set();
  const names = new Set();
  let maxNum = 0;

  for (const ag of doc.list) {
    if (ag && ag.id) {
      ids.add(String(ag.id));
      const n = parseNum(ag.id);
      if (n > maxNum) maxNum = n;
    }
    const nm = ag && (ag.name || ag.callsign);
    if (nm) names.add(String(nm));
  }

  let added = 0;
  let seq = Math.max(maxNum + 1, doc.list.length + 1);

  while (added < BATCH_SIZE) {
    const p = PROFILES[added % PROFILES.length];
    const pad = String(seq).padStart(4, "0");
    const id = `AI-AGT-${pad}`;
    const name = `MARAUDER-${p.code}-${pad}`;

    if (ids.has(id) || names.has(name)) {
      throw new Error(`DUPLICATE_PREVENTED:${id}:${name}`);
    }

    const agent = {
      id,
      name,
      callsign: name,
      role: p.role,
      function: `${p.desc} [профил #${pad}]`,
      model: "ollama:llama3.2",
      status: "REGISTERED",
      createdAt: new Date().toISOString()
    };
    agent.profileHash = crypto.createHash("sha256").update(JSON.stringify(agent)).digest("hex");

    ids.add(id);
    names.add(name);
    doc.list.push(agent);
    added += 1;
    seq += 1;
  }

  saveDoc(doc, TARGET_FILE);

  const check = loadDoc(TARGET_FILE);
  const uIds = new Set(check.list.map((x) => x.id));
  const uNames = new Set(check.list.map((x) => x.name || x.callsign));

  console.log({
    ADDED: added,
    REGISTERED: check.list.length,
    UNIQUE_IDS: uIds.size,
    DUPLICATE_IDS: check.list.length - uIds.size,
    UNIQUE_NAMES: uNames.size,
    DUPLICATE_NAMES: check.list.length - uNames.size
  });
}

main();
