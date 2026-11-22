"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

function ensureLinuxStaging(baseDir) {
  const target = baseDir || path.join(process.env.HOME || "/tmp", "MARAUDER-AI-SD");
  const subdirs = ["web-app", "windows-tor", "android-termux", "flipper-scripts", "m5stack-notes", "backups"];
  fs.mkdirSync(target, { recursive: true });
  for (const sub of subdirs) {
    fs.mkdirSync(path.join(target, sub), { recursive: true });
  }
  return target;
}

function copyStagingToWindows(linuxDir, winDest = "D:\\MARAUDER-AI") {
  const winSrc = execFileSync("wslpath", ["-w", linuxDir], { encoding: "utf8" }).trim();
  execFileSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      `New-Item -ItemType Directory -Force "${winDest}" | Out-Null; Copy-Item -Path "${winSrc}\\*" -Destination "${winDest}" -Recurse -Force`
    ],
    { encoding: "utf8", timeout: 20000 }
  );
  return { winSrc, winDest };
}

module.exports = { ensureLinuxStaging, copyStagingToWindows };
