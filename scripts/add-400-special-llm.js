const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const TARGET_FILE = path.join(process.cwd(), "data", "agent-army", "agents.json");
const ADD_COUNT = 400;

const LLM_TALENTS = [
  { code: "AST-HUNTER", talent: "Синтактичен анализ и откриване на опасни конструкции в JS/Node.js", role: "Code Security" },
  { code: "DEP-AUDITOR", talent: "Одит на зависимости, версии и рискови пакети в package.json", role: "Code Security" },
  { code: "SECRETS-SCOUT", talent: "Разпознаване на изтекли токени, пароли и хардкоднати ключове", role: "Code Security" },
  { code: "LOG-FORENSICS", talent: "Корелация на аномалии и възстановяване на събития в JSONL логове", role: "SOC Division" },
  { code: "CHAIN-VERIFIER", talent: "Проверка на криптографска последователност и хеш вериги", role: "Verification" },
  { code: "SCOPE-GUARD", talent: "Контрол на съответствието между цел, домейн и разрешен обхват", role: "Verification" },
  { code: "PROMPT-SHIELD", talent: "Откриване и неутрализиране на prompt injection и скрити команди", role: "Code Security" },
  { code: "API-CONTRACTOR", talent: "Валидация на REST/JSON схеми, входни параметри и статуси", role: "Verification" },
  { code: "PERF-PROFILER", talent: "Откриване на тесни места, бавни заявки и преразход на памет", role: "Intelligence" },
  { code: "BASH-HARDENER", talent: "Преглед на shell команди и превенция на command injection", role: "Code Security" },
  { code: "NET-OBSERVER", talent: "Анализ на локални портове, процеси и мрежови услуги в обхват", role: "Intelligence" },
  { code: "HTTP-HEADER-ANALYST", talent: "Оценка на защитни HTTP заглавия (CSP, HSTS, X-Frame-Options)", role: "Intelligence" },
  { code: "THREAT-MODELER", talent: "Картографиране на входни точки и повърхност на атака на модул", role: "SOC Division" },
  { code: "EVIDENCE-CURATOR", talent: "Структуриране на проверими доказателства с времеви и хеш маркери", role: "Verification" },
  { code: "INCIDENT-TRIAGER", talent: "Приоритизиране на сигнали по реална тежест без фалшиви тревоги", role: "SOC Division" },
  { code: "CONFIG-SENTINEL", talent: "Откриване на слаби настройки по подразбиране и отворени права", role: "Code Security" },
  { code: "DIFF-REVIEWER", talent: "Сравняване на промени между версии и откриване на регресии", role: "Verification" },
  { code: "BOT-FLOW-ARCHITECT", talent: "Оптимизация на Telegram/Webhook потоци, опашки и retry логика", role: "Intelligence" },
  { code: "SCHEMA-NORMALIZER", talent: "Уеднаквяване на сурови изходи от инструменти в чист JSON формат", role: "Verification" },
  { code: "ROOT-DISPATCH-SYNTH", talent: "Декомпозиция на сложна задача на безопасни, проверими подзадачи", role: "Intelligence" }
];

const OPERATIONAL_GOALS = [
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
  const preview = [];

  while (added < ADD_COUNT) {
    const tIdx = added % LLM_TALENTS.length;
    const gIdx = Math.floor(added / LLM_TALENTS.length) % OPERATIONAL_GOALS.length;
    const talentObj = LLM_TALENTS[tIdx];
    const goalText = OPERATIONAL_GOALS[gIdx];

    const padded = String(seqCandidate).padStart(4, "0");
    const id = `AI-AGT-${padded}`;
    const name = `LLM-${talentObj.code}-${padded}`;
    const fullGoal = `${talentObj.talent} — цел: ${goalText}`;

    if (existingIds.has(id) || existingNames.has(name)) {
      throw new Error(`DUPLICATE_COLLISION_PREVENTED:${id}:${name}`);
    }

    const agent = {
      id,
      name,
      callsign: name,
      type: "SPECIAL_LLM",
      role: talentObj.role,
      talentCode: talentObj.code,
      talent: talentObj.talent,
      goal: goalText,
      function: fullGoal,
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

    if (preview.length < 10) {
      preview.push(`${id} | ${name} | Талант: ${talentObj.talent} | Цел: ${goalText}`);
    }

    added += 1;
    seqCandidate += 1;
  }

  saveAgentsDoc(doc, TARGET_FILE);

  const verifyDoc = loadAgentsDoc(TARGET_FILE);
  const finalIds = new Set(verifyDoc.list.map((x) => x.id));
  const finalNames = new Set(verifyDoc.list.map((x) => x.name || x.callsign));

  console.log("=== SAMPLE OF NEW SPECIAL LLM AGENTS ===");
  for (const line of preview) console.log(line);
  console.log("\n=== CATALOG SUMMARY ===");
  console.log({
    ADDED_SPECIAL_LLM: added,
    REGISTERED: verifyDoc.list.length,
    UNIQUE_IDS: finalIds.size,
    DUPLICATE_IDS: verifyDoc.list.length - finalIds.size,
    UNIQUE_NAMES: finalNames.size,
    DUPLICATE_NAMES: verifyDoc.list.length - finalNames.size
  });
}

main();
