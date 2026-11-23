const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const rootDir = path.join(__dirname, "..");
const queueFile = path.join(rootDir, "data", "jobs-queue.json");
const stateFile = path.join(rootDir, "public", "api", "demon-state.json");
const logFile = path.join(rootDir, "logs", "demon.log");

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
}

function ensureQueue() {
  if (!fs.existsSync(queueFile)) {
    fs.writeFileSync(
      queueFile,
      JSON.stringify(
        [
          { id: "job-catalog", type: "catalog", status: "pending" },
          { id: "job-telemetry", type: "telemetry", status: "pending" },
          { id: "job-integrity", type: "integrity", status: "pending" }
        ],
        null,
        2
      )
    );
  }
  return JSON.parse(fs.readFileSync(queueFile, "utf8"));
}

function runJob(job) {
  if (job.type === "catalog") {
    execSync("node scripts/generate-tools-catalog.js", { cwd: rootDir, stdio: "ignore" });
  } else if (job.type === "telemetry") {
    execSync("node -e 'const fs=require(\"fs\");fs.writeFileSync(\"public/api/console-status.json\",JSON.stringify({updatedAt:new Date().toISOString(),mode:\"DEMON_ACTIVE\",status:\"ONLINE\"},null,2))'", { cwd: rootDir, stdio: "ignore" });
  } else if (job.type === "integrity") {
    const dlDir = path.join(rootDir, "public", "downloads");
    fs.mkdirSync(dlDir, { recursive: true });
    const files = fs.readdirSync(dlDir).map((f) => {
      const p = path.join(dlDir, f);
      return { file: f, bytes: fs.statSync(p).size };
    });
    fs.writeFileSync(path.join(rootDir, "public", "api", "downloads-check.json"), JSON.stringify({ checkedAt: new Date().toISOString(), files }, null, 2));
  }
}

function cycle() {
  const queue = ensureQueue();
  let processed = 0;

  for (const job of queue) {
    if (job.status === "pending") {
      try {
        runJob(job);
        job.status = "done";
        job.finishedAt = new Date().toISOString();
        processed++;
        log(`DONE ${job.id} (${job.type})`);
      } catch (err) {
        job.retries = (job.retries || 0) + 1;
        job.lastError = err.message;
        if (job.retries >= 3) {
          job.status = "fallback-done";
          log(`FALLBACK ${job.id}: ${err.message}`);
        } else {
          log(`RETRY ${job.id} (#${job.retries}): ${err.message}`);
        }
      }
    }
  }

  fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));
  fs.writeFileSync(
    stateFile,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        law: "GANGSTA_DEV_ENGINEERING",
        processedInCycle: processed,
        totalJobs: queue.length,
        doneCount: queue.filter((j) => j.status === "done" || j.status === "fallback-done").length
      },
      null,
      2
    )
  );
}

log("GANGSTA DEMON STARTED");
cycle();
setInterval(cycle, 10000);
