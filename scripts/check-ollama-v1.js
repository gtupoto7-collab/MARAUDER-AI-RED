const http = require("http");

function checkOllama() {
  return new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:11434/api/tags", { timeout: 2500 }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          const models = (parsed.models || []).map((m) => m.name);
          resolve({ reachable: true, statusCode: res.statusCode, models });
        } catch {
          resolve({ reachable: true, statusCode: res.statusCode, models: [], rawError: "Invalid JSON from Ollama" });
        }
      });
    });
    req.on("error", (err) => {
      resolve({ reachable: false, error: err.message });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({ reachable: false, error: "Connection timeout to 127.0.0.1:11434" });
    });
  });
}

checkOllama().then((result) => {
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.reachable ? 0 : 1);
});
