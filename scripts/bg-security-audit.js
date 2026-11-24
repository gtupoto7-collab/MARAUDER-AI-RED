const { MissionOrchestrator } = require("../modules/mission-orchestrator");

function parseArgs(argv) {
  const args = { scope: "local-wsl", url: "", out: "" };
  for (let i = 2; i < argv.length; i++) {
    const cur = argv[i];
    if (cur === "--scope" && argv[i + 1]) args.scope = argv[++i];
    else if (cur === "--url" && argv[i + 1]) args.url = argv[++i];
    else if (cur === "--out" && argv[i + 1]) args.out = argv[++i];
  }
  return args;
}

async function main() {
  const opts = parseArgs(process.argv);
  const orch = new MissionOrchestrator({
    allowedScopes: ["local-wsl", "approved-lab", "owned-lab", "bg-owned-web"]
  });

  const report = await orch.assessInfrastructure({
    targetScope: opts.scope,
    targetUrl: opts.url,
    cwd: process.cwd()
  });

  let savedPath = null;
  if (opts.out) {
    savedPath = orch.exportAssessmentReport(report, opts.out);
  }

  console.log("=== MARAUDER BG SECURITY AUDIT ===");
  console.log(`Scope: ${report.targetScope} | Профил: ${report.bgContext.locale} (${report.bgContext.currency})`);
  console.log(`Всички проверки верифицирани: ${report.allVerified ? "ДА" : "НЕ"} | Време: ${report.totalDurationMs} ms`);
  console.log(`Риск -> HIGH: ${report.riskSummary.high}, MEDIUM: ${report.riskSummary.medium}, LOW: ${report.riskSummary.low}`);
  console.log(`AssetGraph -> активи: ${report.assetGraph.totalAssets}, в риск: ${report.assetGraph.atRisk}, верифицирани: ${report.assetGraph.verified}`);

  for (const f of report.findings) {
    console.log(` - [${f.riskLevel.toUpperCase()}] ${f.jobId || "N/A"} | ok=${f.ok} | hashValid=${f.integrityValid} | agent=${f.agent || "N/A"} (${f.durationMs}ms)`);
    if (Array.isArray(f.remediation) && f.remediation.length) {
      console.log(`    Препоръка: ${f.remediation[0]}`);
    }
  }

  if (savedPath) {
    console.log(`Отчетът е записан в: ${savedPath}`);
  }
}

main().catch((err) => {
  console.error("AUDIT_FAILED:", err);
  process.exit(1);
});
