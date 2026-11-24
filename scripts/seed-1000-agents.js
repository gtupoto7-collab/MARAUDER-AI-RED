const assert = require("assert");
const MarauderAgentArmyHub = require("../modules/agent-army-hub");

const DIVISIONS = [
  { role: "Intelligence", prefix: "Intel", model: "ollama:llama3.2", caps: ["reasoning.plan", "evidence.verify"] },
  { role: "Cyber Defense", prefix: "Def", model: "ollama:llama3.2", caps: ["code.audit", "filesystem.read"] },
  { role: "Offensive Security", prefix: "RedLab", model: "ollama:llama3.2", caps: ["network.observe", "code.audit"] },
  { role: "Malware Lab", prefix: "MalLab", model: "ollama:llama3.2", caps: ["filesystem.read", "evidence.verify"] },
  { role: "Network Intelligence", prefix: "NetIntel", model: "ollama:llama3.2", caps: ["network.observe"] },
  { role: "Cloud Security", prefix: "CloudSec", model: "ollama:llama3.2", caps: ["dependency.audit", "code.audit"] },
  { role: "Code Security", prefix: "CodeSec", model: "ollama:llama3.2", caps: ["code.audit", "filesystem.read"] },
  { role: "SOC Division", prefix: "SOC", model: "ollama:llama3.2", caps: ["network.observe", "evidence.verify"] },
  { role: "AI Research", prefix: "AIRnd", model: "ollama:llama3.2", caps: ["reasoning.plan", "code.audit"] },
  { role: "Verification", prefix: "Verify", model: "ollama:llama3.2", caps: ["evidence.verify", "dependency.audit"] }
];

const SPECIALTIES = [
  "Scanner", "Auditor", "Correlator", "Verifier", "Tracer", "Inspector", "Analyst", "Sentinel"
];

async function runSeedAndTests() {
  const hub = new MarauderAgentArmyHub(process.cwd());
  const batch = [];

  // 10 отдела * 128 профила = 1280 специализирани агента (> 1000)
  for (const div of DIVISIONS) {
    for (let i = 1; i <= 128; i++) {
      const spec = SPECIALTIES[(i - 1) % SPECIALTIES.length];
      const cap = div.caps[(i - 1) % div.caps.length];
      batch.push({
        name: `${div.prefix}-${spec} #${String(i).padStart(3, "0")}`,
        role: div.role,
        model: div.model,
        capabilities: [cap]
      });
    }
  }

  const res = hub.registerMany(batch);
  const all = hub.listAgents();

  // Тест 1: Над 1000 агента и уникални ID-та без колизии
  assert(all.length >= 1000, `Очаквахме >= 1000 агента, получихме ${all.length}`);
  const uniqueIds = new Set(all.map((a) => a.id));
  assert.strictEqual(uniqueIds.size, all.length, "Открити дублирани Agent ID-та");

  // Тест 2: Валидна схема за всеки агент
  for (const agent of all) {
    assert(typeof agent.id === "string" && agent.id.length > 0, "Липсва id");
    assert(typeof agent.name === "string" && agent.name.length > 0, "Липсва name");
    assert(Array.isArray(agent.capabilities) && agent.capabilities.length > 0, "Липсват capabilities");
    assert(typeof agent.health === "number", "Липсва health");
  }

  // Тест 3: Изпълнение на реална локална проверка през агент от горния край на пула
  const target = all[1020];
  const execution = await hub.executeTask({
    agentId: target.id,
    capability: target.capabilities[0],
    task: "Проверка на локалните файлове и зависимости в проекта"
  });

  assert(execution && execution.runId, "Липсва runId при изпълнение");
  assert(execution.hash && execution.hash.length === 64, "Липсва валиден SHA-256 хеш");

  console.log(
    JSON.stringify(
      {
        ok: true,
        totalAgents: res.total,
        uniqueIds: uniqueIds.size,
        testedAgent: target.id,
        capability: execution.capability,
        verified: execution.verified,
        hashPrefix: execution.hash.slice(0, 12)
      },
      null,
      2
    )
  );
}

runSeedAndTests().catch((err) => {
  console.error("SEED_TEST_FAILED:", err);
  process.exit(1);
});
