const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const pubDir = path.join(root, "public");
const serverFile = path.join(root, "server.js");

const serverSrc = fs.existsSync(serverFile) ? fs.readFileSync(serverFile, "utf8") : "";
const registeredRoutes = new Set();
for (const m of serverSrc.matchAll(/\bapp\.(get|post|put|patch|delete|use)\s*\(\s*["'`]([^"'`]+)["'`]/gi)) {
  registeredRoutes.add(`${m[1].toUpperCase()} ${m[2]}`);
}

const htmlFiles = fs.existsSync(pubDir)
  ? fs.readdirSync(pubDir).filter((f) => f.endsWith(".html")).sort()
  : [];

const report = {
  auditedAt: new Date().toISOString(),
  publicFilesPresent: {
    universalBackJs: fs.existsSync(path.join(pubDir, "universal-back.js")),
    shieldLiveJs: fs.existsSync(path.join(pubDir, "shield-live.js"))
  },
  registeredServerRoutes: Array.from(registeredRoutes).sort(),
  pages: {}
};

for (const file of htmlFiles) {
  const full = path.join(pubDir, file);
  const html = fs.readFileSync(full, "utf8");

  const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)].map((m) => {
    const attrs = m[1] || "";
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
    const onclickMatch = attrs.match(/\bonclick=["']([^"']+)["']/i);
    const suspiciousLiteralJs = /(\+\s*\(|\)\s*\+|`|\$\{|\bundefined\b)/.test(text);
    return {
      id: idMatch ? idMatch[1] : null,
      text,
      onclick: onclickMatch ? onclickMatch[1] : null,
      suspiciousLiteralJs
    };
  });

  const externalLinks = [...html.matchAll(/<a\b[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({
    href: m[1].trim(),
    label: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  }));

  const apiCalls = [...html.matchAll(/fetch\s*\(\s*["'`](\/api\/[^"'`?]+)["'`][^)]*\)/g)].map((m) => {
    const ep = m[1].trim();
    const snippet = m[0];
    const methodMatch = snippet.match(/method\s*:\s*["'`](GET|POST|PUT|PATCH|DELETE)["'`]/i);
    const method = (methodMatch ? methodMatch[1] : "GET").toUpperCase();
    const exists = registeredRoutes.has(`${method} ${ep}`) || registeredRoutes.has(`USE ${ep}`);
    return { endpoint: ep, method, existsInServer: exists };
  });

  const inlineHandlers = {
    addEventListenerClicks: (html.match(/addEventListener\s*\(\s*["']click["']/gi) || []).length,
    inlineOnclickCount: (html.match(/\bonclick\s*=/gi) || []).length,
    hasUniversalBack: html.includes("universal-back.js"),
    hasShieldLive: html.includes("shield-live.js")
  };

  report.pages[file] = {
    buttonsCount: buttons.length,
    buttons,
    externalLinks,
    apiCalls,
    handlersSummary: inlineHandlers
  };
}

fs.writeFileSync("/tmp/marauder-full-audit.json", JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify(report, null, 2));
