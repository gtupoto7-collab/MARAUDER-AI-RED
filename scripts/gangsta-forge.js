const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const rootDir = path.join(__dirname, "..");
const queueFile = path.join(rootDir, "data", "jobs-queue.json");
const reportsDir = path.join(rootDir, "data", "reports");

async function askMythos(prompt) {
  try {
    const res = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama3.2", prompt, stream: false }),
      signal: AbortSignal.timeout(4000)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.response) return { engine: "ollama-llama3.2", reply: data.response.trim() };
    }
  } catch {}
  return {
    engine: "mythos-local-fallback",
    reply: `MYTHOS EXECUTED: ${prompt} | Status: READY & DETERMINISTIC`
  };
}

function enqueueBurst(count = 3) {
  const queue = fs.existsSync(queueFile) ? JSON.parse(fs.readFileSync(queueFile, "utf8")) : [];
  const types = ["catalog", "telemetry", "integrity"];
  for (let i = 0; i < count; i++) {
    queue.push({
      id: `burst-${Date.now()}-${i + 1}`,
      type: types[i % types.length],
      status: "pending"
    });
  }
  fs.writeFileSync(queueFile, JSON.stringify(queue, null, 2));
  return queue.length;
}

(async () => {
  const mode = process.argv[2] || "report";
  const topic = process.argv.slice(3).join(" ") || "MARAUDER v12.0 AI Full Automation";
  const ai = await askMythos(topic);
  const totalQueue = enqueueBurst(3);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportFile = path.join(reportsDir, `report-${stamp}.md`);
  const content = [
    `# MARAUDER REPORT — ${topic}`,
    `- Timestamp: ${new Date().toISOString()}`,
    `- Engine: ${ai.engine}`,
    `- Queue Size After Burst: ${totalQueue}`,
    ``,
    `## Output`,
    ai.reply
  ].join("\n");

  fs.writeFileSync(reportFile, content);
  console.log("REPORT:", reportFile);
  console.log("ENGINE:", ai.engine);
  console.log("QUEUE_TOTAL:", totalQueue);
})();
