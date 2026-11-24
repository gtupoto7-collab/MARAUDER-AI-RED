const { spawnSync } = require("child_process");

function runSinglePrompt(promptText, timeoutMs = 15000) {
  const t0 = Date.now();
  const res = spawnSync("ollama", ["run", "llama3.2", promptText], {
    encoding: "utf8",
    shell: false,
    timeout: timeoutMs
  });
  const elapsedMs = Date.now() - t0;
  const ok = !res.error && res.status === 0 && String(res.stdout || "").trim().length > 0;
  return {
    ok,
    elapsedMs,
    exitCode: typeof res.status === "number" ? res.status : 1,
    error: res.error ? res.error.message : null
  };
}

function runBatch(count) {
  let passed = 0;
  let failed = 0;
  let totalMs = 0;

  for (let i = 1; i <= count; i++) {
    const r = runSinglePrompt(`Отговори само с думата OK за проверка #${i}.`, 15000);
    totalMs += r.elapsedMs;
    if (r.ok) passed += 1;
    else failed += 1;
  }

  return {
    batchSize: count,
    passed,
    failed,
    avgMs: Number((totalMs / count).toFixed(1)),
    totalMs
  };
}

function main() {
  for (const step of [10, 25, 50]) {
    const summary = runBatch(step);
    console.log("BENCHMARK_STEP:", JSON.stringify(summary));
  }
}

main();
