const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const TARGET_FILE = path.join(process.cwd(), "data", "agent-army", "agents.json");
const ADD_COUNT = 400;

const DIVISIONS = [
  {
    role: "Intelligence",
    fnPrefix: "Сбира и сверява технически индикатори и зависимости в обхват",
    model: "ollama:llama3.2"
  },
  {
    role: "Code Security",
    fnPrefix: "Проверява модули и скриптове за опасни конструкции и слаби места",
    model: "ollama:llama3.2"
  },
  {
    role: "Verification",
    fnPrefix: "Удостоверява изходи, хешове и съответствие спрямо зададената задача",
    model: "deterministic-verifier"
  },
  {
    role: "SOC Division",
    fnPrefix: "Анализира логове, аномалии и целостта на одитната верига",
    model: "ollama:llama3.2"
  },
  {
    role: "Integrity & Audit",
    fnPrefix: "Следи SHA-256 целостта на файлове, конфигурации и артефакти",
    model: "deterministic-auditor"
  }
];

function loadAgentsDoc(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`AGENTS_FILE_NOT_FOUND:${filePath}`);
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (Array.isArray(raw)) {
    return { mode: "array", root: raw, list: raw };
  }
  if (raw && Array.isArray(raw.agents)) {
    return { mode: "object", root: raw, list: raw.agents };
  }
  throw new Error("UNSUPPORTED_AGENTS_JSON_STRUCTURE");
}

function saveAgentsDoc(doc, filePath) {
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
  const doc = loadAgentsDoc(TARGET_FILE);
  const existingIds = new Set();
  const existingNames = new Set();
  let maxNum = 0;

  for (const ag of doc.list) {
    if (ag && ag.id) {
      existingIds.add(String(ag.id));
      const n = parseNum(ag.id);
      if (n > maxNum) maxNum = n;
    }
    const nm = ag && (ag.name || ag.callsign);
    if (nm) existingNames.add(String(nm));
  }

  let added = 0;
  let seqCandidate = Math.max(maxNum + 1, doc.list.length + 1);

  while (added < ADD_COUNT) {
    const padded = String(seqCandidate).padStart(4, "0");
    const id = `AI-AGT-${padded}`;
    const div = DIVISIONS[added % DIVISIONS.length];
    const name = `MARAUDER-${div.role.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-${padded}`;
    const funcSpec = `${div.fnPrefix} [слот #${padded} / канал ${div.role}]`;

    if (existingIds.has(id) || existingNames.has(name)) {
      throw new Error(`DUPLICATE_COLLISION_PREVENTED:${id}:${name}`);
    }

    const agent = {
      id,
      name,
      callsign: name,
      role: div.role,
      function: funcSpec,
      model: div.model,
      status: "REGISTERED",
      createdAt: new Date().toISOString()
    };

    agent.profileHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(agent))
      .digest("hex");

    existingIds.add(id);
    existingNames.add(name);
    doc.list.push(agent);
    added += 1;
    seqCandidate += 1;
  }

  saveAgentsDoc(doc, TARGET_FILE);

  // Final audit after write
  const verifyDoc = loadAgentsDoc(TARGET_FILE);
  const finalIds = new Set(verifyDoc.list.map((x) => x.id));
  const finalNames = new Set(verifyDoc.list.map((x) => x.name || x.callsign));

  console.log({
    REGISTERED: verifyDoc.list.length,
    UNIQUE_IDS: finalIds.size,
    DUPLICATE_IDS: verifyDoc.list.length - finalIds.size,
    UNIQUE_NAMES: finalNames.size,
    DUPLICATE_NAMES: verifyDoc.list.length - finalNames.size
  });
}

main();
