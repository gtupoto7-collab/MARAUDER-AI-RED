const { RealArmyCore } = require("../modules/real-army-v1");
const { RealityEngine } = require("../modules/reality-engine");
const { runSafeLocalCheck } = require("../modules/safe-local-executor");

async function runSmoke() {
  const realityEngine = new RealityEngine();
  const army = new RealArmyCore({
    allowedScopes: ["local-wsl", "approved-lab"],
    minApprovals: 2
  });

  const checks = [
    {
      title: "Real Read-Only Dependency Audit",
      description: "dependency-audit npm lockfile vulnerabilities",
      checkName: "dependency-audit",
      capability: "filesystem.read"
    },
    {
      title: "Real Read-Only Local Listeners Inspection",
      description: "local-listeners sockets ports processes",
      checkName: "local-listeners",
      capability: "network.observe"
    }
  ];

  const submittedIds = [];

  for (const item of checks) {
    const res = army.submitJob({
      title: item.title,
      description: item.description,
      targetScope: "local-wsl",
      runner: async (job) => {
        const execRes = await runSafeLocalCheck({
          realityEngine,
          checkName: item.checkName,
          target: job.targetScope,
          agent: job.agentName,
          grantedCapabilities: [item.capability],
          cwd: process.cwd(),
          timeoutMs: 20000
        });

        const riskLevel = execRes.normalized?.riskLevel
          || (Array.isArray(execRes.normalized?.listeners) && execRes.normalized.listeners.some((l) => l.risk === "medium")
            ? "medium"
            : "low");

        return {
          claim: `${item.checkName} executed in read-only mode on ${job.targetScope}`,
          riskLevel,
          evidence: {
            id: execRes.record.id,
            source: "safe-local-executor",
            observation: JSON.stringify(execRes.normalized || { stdout: execRes.stdout.slice(0, 400) }),
            verified: execRes.ok
          }
        };
      }
    });

    if (res.ok && res.job) {
      submittedIds.push(res.job.id);
    } else {
      console.error("Failed to submit:", item.checkName, res.error);
    }
  }

  await new Promise((r) => setTimeout(r, 400));

  for (const jobId of submittedIds) {
    const job = army.jobs.find((j) => j.id === jobId);
    const archive = (typeof army.getMissionArchive === "function" ? army.getMissionArchive.bind(army) : () => [])(jobId);
    console.log("--------------------------------------------------");
    console.log("JOB:", job.id, "| Role:", job.agentName, "| Status:", job.status, "| Verified:", job.verified);
    console.log("BlackBox Integrity Valid:", archive?.integrity?.valid, "| Entries:", archive?.entries?.length);
    console.log("Parliament Authorized:", job.parliamentAuthorization?.authorized, "| Risk:", job.parliamentAuthorization?.riskCheck?.riskLevel);
    if (job.result?.evidence?.observation) {
      console.log("Evidence Snapshot:", job.result.evidence.observation.slice(0, 260));
    }
  }

  // Проверка на забранен scope
  const outOfScope = army.submitJob({
    title: "Out of scope check",
    targetScope: "unauthorized-target",
    authorizedScope: false
  });
  console.log("--------------------------------------------------");
  console.log("Out-of-scope blocked:", outOfScope.ok === false, "| Reason:", outOfScope.error);
}

runSmoke().catch((err) => {
  console.error("SMOKE_ERROR:", err);
  process.exit(1);
});


const { MarauderWarfareSimulator } = require("../modules/warfare/warfare-simulator");
const warfareSim = new MarauderWarfareSimulator();
const warfareRun = warfareSim.runScenario({ name: "BLACK SEA SHIELD", swarmCount: 3 });
if (!warfareRun || !warfareRun.runId || warfareRun.automaticWeaponsRelease !== false) {
  throw new Error("Warfare simulation smoke check failed");
}
console.log("WARFARE SMOKE PASS |", warfareRun.runId, "| risk=", warfareRun.blueAssessment.riskScore, "| mc=", warfareRun.monteCarlo.expectedRiskScore);
