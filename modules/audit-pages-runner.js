"use strict";

const fs = require("fs");
const path = require("path");

function auditProject(rootDir = path.join(__dirname, "..")) {
  const pubDir = path.join(rootDir, "public");
  const serverFile = path.join(rootDir, "server.js");
  const serverSrc = fs.existsSync(serverFile) ? fs.readFileSync(serverFile, "utf8") : "";

  const registeredRoutes = new Set();
  for (const m of serverSrc.matchAll(/\bapp\.(get|post|put|patch|delete|use)\s*\(\s*["'`]([^"'`]+)["'`]/gi)) {
    registeredRoutes.add(`${m[1].toUpperCase()} ${m[2]}`);
  }

  const htmlFiles = fs.existsSync(pubDir)
    ? fs.readdirSync(pubDir).filter((f) => f.endsWith(".html")).sort()
    : [];

  const pages = {};
  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(pubDir, file), "utf8");
    const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)].map((m) => {
      const attrs = m[1] || "";
      const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const idMatch = attrs.match(/\bid=["']([^"']+)["']/i);
      const onclickMatch = attrs.match(/\bonclick=["']([^"']+)["']/i);
      const brokenTemplateText = /(\+\s*\(|\)\s*\+|`|\$\{|\bundefined\b)/.test(text);
      return {
        id: idMatch ? idMatch[1] : null,
        text,
        onclick: onclickMatch ? onclickMatch[1] : null,
        brokenTemplateText
      };
    });

    const apiCalls = [...html.matchAll(/fetch\s*\(\s*["'`](\/api\/[^"'`?]+)["'`][^)]*\)/g)].map((m) => {
      const ep = m[1].trim();
      const methodMatch = m[0].match(/method\s*:\s*["'`](GET|POST|PUT|PATCH|DELETE)["'`]/i);
      const method = (methodMatch ? methodMatch[1] : "GET").toUpperCase();
      return {
        endpoint: ep,
        method,
        existsInServer: registeredRoutes.has(`${method} ${ep}`) || registeredRoutes.has(`USE ${ep}`)
      };
    });

    pages[file] = {
      buttonsCount: buttons.length,
      buttons,
      apiCalls,
      hasUniversalBack: html.includes("universal-back.js"),
      hasShieldLive: html.includes("shield-live.js")
    };
  }

  return {
    auditedAt: new Date().toISOString(),
    routesCount: registeredRoutes.size,
    pages
  };
}

module.exports = { auditProject };
