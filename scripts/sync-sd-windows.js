const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const linuxStage = process.env.LINUX_STAGE_DIR || "/mnt/c/Users/gtupo/MARAUDER-AI-SD";
const winDest = process.env.WIN_SD_DEST || "D:\\MARAUDER-AI";

fs.mkdirSync(linuxStage, { recursive: true });

function toWinPath(p) {
  if (/^[A-Za-z]:\\/.test(p)) return p;
  return execFileSync("wslpath", ["-w", p], { encoding: "utf8" }).trim();
}

function runPs(psCommand) {
  return execFileSync("powershell.exe", ["-NoProfile", "-Command", psCommand], {
    encoding: "utf8",
    timeout: 20000
  }).trim();
}

const winStage = toWinPath(linuxStage);

try {
  runPs(`New-Item -ItemType Directory -Force "${winDest}" | Out-Null`);
  runPs(`Copy-Item -Path "${winStage}\\*" -Destination "${winDest}" -Recurse -Force`);
  console.log("PS_SYNC_OK ->", winStage, "=>", winDest);
} catch (err) {
  console.error("PS_SYNC_WARN ->", err.message);
}

try {
  const found = runPs(
    `$paths = @("C:\\Program Files","C:\\Program Files (x86)","$env:LOCALAPPDATA","$env:USERPROFILE\\Desktop","$env:USERPROFILE\\Downloads"); ` +
    `$cmd = Get-Command tor.exe -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source; ` +
    `if ($cmd) { Write-Output $cmd } ` +
    `foreach ($p in $paths) { ` +
    `  if (Test-Path $p) { ` +
    `    try { Get-ChildItem -Path $p -Filter "tor.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 3 -ExpandProperty FullName } catch {} ` +
    `  } ` +
    `}`
  );
  console.log("TOR_EXE_SEARCH ->", found || "NOT_FOUND");
} catch (err) {
  console.log("TOR_EXE_SEARCH_ERR ->", err.message);
}
