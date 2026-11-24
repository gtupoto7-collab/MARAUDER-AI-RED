const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const TARGET_FILE = path.join(process.cwd(), "data", "agent-army", "agents.json");
const ADD_COUNT = 500;

const SPECIAL_TALENTS = [
  { code: "INJECT-GUARD", talent: "Откриване на опити за prompt injection и скрити инструкции в данни", role: "Code Security" },
  { code: "TOKEN-AUDITOR", talent: "Проверка на срокове, обхват и еднократна употреба на токени", role: "Verification" },
  { code: "CHAIN-SENTRY", talent: "Следене на последователността seq и prevHash в одитния лог", role: "SOC Division" },
  { code: "ENV-INSPECTOR", talent: "Сверяване на конфигурационни променливи и липсващи защитни флагове", role: "Code Security" },
  { code: "JSONL-PARSING", talent: "Валидация на потокови JSONL записи и ранно хващане на корупция", role: "Verification" },
  { code: "SUBPROCESS-SAFE", talent: "Контрол на параметри, таймаути и нулев shell при стартиране на инструменти", role: "Code Security" },
  { code: "SCOPE-ENFORCER", talent: "Сравняване на реалната цел (IP/домейн/път) с разрешената зона", role: "Verification" },
  { code: "DUP-DETECTOR", talent: "Засичане на повтарящи се задачи, дублирани ID-та и колизии", role: "Integrity & Audit" },
  { code: "LATENCY-WATCH", talent: "Измерване на време за отговор и откриване на забавени етапи", role: "Intelligence" },
  { code: "MEM-GUARDIAN", talent: "Следене на разхода на памет и предотвратяване на лавинообразни бачове", role: "SOC Division" },
  { code: "HASH-NOTARY", talent: "Генериране и сверяване на SHA-256 отпечатъци върху артефакти", role: "Integrity & Audit" },
  { code: "EXITCODE-JUDGE", talent: "Тълкуване на exit кодове, stderr и реални признаци за успех", role: "Verification" },
  { code: "RULE-SYNTH", talent: "Извличане на конкретни правила за проверка от открити грешки", role: "Intelligence" },
  { code: "RETRY-PLANNER", talent: "Определяне на безопасни повторни опити при временни сривове", role: "Intelligence" },
  { code: "DRIFT-SCANNER", talent: "Откриване на отклонения спрямо базовата конфигурация на проекта", role: "Integrity & Audit" },
  { code: "SECRET-SWEEPER", talent: "Търсене на случайни ключове, пароли и чувствителни низове", role: "Code Security" },
  { code: "HEADER-CHECKER", talent: "Анализ на защитни заглавия и политики при HTTP отговори", role: "Intelligence" },
  { code: "QUEUE-BALANCER", talent: "Разпределение на задачи между работници без претоварване", role: "SOC Division" },
  { code: "EVIDENCE-LINKER", talent: "Свързване на всяка констатация към конкретен запис в лога", role: "Verification" },
  { code: "FALLBACK-JUDGE", talent: "Проверка дали резервният път е безопасен и реално изпълнен", role: "Verification" },
  { code: "PATH-TRAVERSAL", talent: "Контрол на файлови пътища срещу излизане извън разрешената папка", role: "Code Security" },
  { code: "PORT-READER", talent: "Четене на състояние на локални/разрешени услуги в обхват", role: "Intelligence" },
  { code: "SCHEMA-GUARD", talent: "Проверка на типове, задължителни полета и формати на данни", role: "Verification" },
  { code: "RECOVERY-LEAD", talent: "Подготовка на стъпки за чисто възстановяване след спиране", role: "SOC Division" },
  { code: "SUMMARY-BRIEF", talent: "Обобщаване на технически резултати в ясен, кратък инженерен вид", role: "Intelligence" }
];

const MISSION_GOALS = [
  "Ядрото на MARAUDER ROOT Controller и модулите за удостоверяване",
  "Парсерите и валидаторите на входни потребителски данни",
  "Одитната верига BlackBox и целостта на записите",
  "Локалните Node.js микроуслуги и вътрешни API крайни точки",
  "Конфигурационните файлове и променливите на средата",
  "Скриптовете за автоматизация и управление на опашки",
  "Собствени уеб активи и пасивна диагностика на HTTP отговори",
  "Контрола на таймаути, грешки и изолация на подпроцеси",
  "Откриване на дублирани или невалидни записи в каталога на агентите",
  "Защитата срещу неразрешени външни цели извън одобрения scope",
  "Синтез на кратки инженерни доклади с конкретни доказателства",
  "Проверка на правата за достъп и валидността на approval токените",
  "Мониторинг на натоварването и стабилността при паралелни бачове",
  "Разграничаване на реално изпълнени проверки от симулирани статуси",
  "Инвентаризация на наличните локални инструменти и техните версии",
  "Анализ на грешки при мрежови и файлови операции",
  "Контрол на качеството преди включване на нов модул в продукция",
  "Проверка на устойчивостта на Kill Switch при повредени файлове",
  "Оценка на сигурността на Telegram ботове и webhook маршрути",
  "Подготовка на проверими препоръки за заздравяване на системата"
];

function loadAgentsDoc(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`AGENTS_FILE_NOT_FOUND:${filePath}`);
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (Array.isArray(raw)) return { mode: "array", root: raw, list: raw };
  if (raw && Array.isArray(raw.agents)) return { mode: "object", root: raw, list: raw.agents };
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
  const sample = [];

  while (added < ADD_COUNT) {
    const tObj = SPECIAL_TALENTS[added % SPECIAL_TALENTS.length];
    const goal = MISSION_GOALS[Math.floor(added / SPECIAL_TALENTS.length) % MISSION_GOALS.length];

    const padded = String(seqCandidate).padStart(4, "0");
    const id = `AI-AGT-${padded}`;
    const name = `SPEC-${tObj.code}-${padded}`;
    const fullSpec = `${tObj.talent} — цел: ${goal}`;

    if (existingIds.has(id) || existingNames.has(name)) {
      throw new Error(`DUPLICATE_COLLISION_PREVENTED:${id}:${name}`);
    }

    const agent = {
      id,
      name,
      callsign: name,
      type: "SPECIAL_LLM",
      role: tObj.role,
      talentCode: tObj.code,
      talent: tObj.talent,
      goal,
      function: fullSpec,
      model: "ollama:llama3.2",
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

    if (sample.length < 8) {
      sample.push(`${id} | ${name} | ${tObj.talent} | Цел: ${goal}`);
    }

    added += 1;
    seqCandidate += 1;
  }

  saveAgentsDoc(doc, TARGET_FILE);

  const verifyDoc = loadAgentsDoc(TARGET_FILE);
  const finalIds = new Set(verifyDoc.list.map((x) => x.id));
  const finalNames = new Set(verifyDoc.list.map((x) => x.name || x.callsign));

  console.log("=== SAMPLE OF 500 NEW SPECIAL AGENTS ===");
  for (const line of sample) console.log(line);
  console.log("\n=== CATALOG SUMMARY ===");
  console.log({
    ADDED_SPECIAL_AGENTS: added,
    REGISTERED: verifyDoc.list.length,
    UNIQUE_IDS: finalIds.size,
    DUPLICATE_IDS: verifyDoc.list.length - finalIds.size,
    UNIQUE_NAMES: finalNames.size,
    DUPLICATE_NAMES: verifyDoc.list.length - finalNames.size
  });
}

main();
