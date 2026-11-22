const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const projectRoot = path.join(__dirname, "..");
const sdBase = process.env.SD_TARGET || "/mnt/d/MARAUDER-AI";

const subdirs = [
"web-app",
"windows-tor",
"android-termux",
"flipper-scripts",
"m5stack-notes",
"backups"
];

if (!fs.existsSync(sdBase)) {
fs.mkdirSync(sdBase, { recursive: true });
}

for (const d of subdirs) {
fs.mkdirSync(path.join(sdBase, d), { recursive: true });
}

const pubSrc = path.join(projectRoot, "public");
if (fs.existsSync(pubSrc)) {
fs.cpSync(pubSrc, path.join(sdBase, "web-app", "public"), { recursive: true, force: true });
}

const defaultUser = process.env.MARAUDER_ADMIN_USER || "ADMIRALERROR";
const defaultPass = process.env.MARAUDER_ADMIN_PASS || "REDSOFTWARETEAM";
const passSalt = crypto.randomBytes(16).toString("hex");
const passHash = crypto.scryptSync(defaultPass, passSalt, 64).toString("hex");

const accessConfig = {
adminUser: defaultUser,
salt: passSalt,
passwordHash: passHash,
updatedAt: new Date().toISOString()
};

const localCfgPath = path.join(projectRoot, "access-config.json");
const sdCfgPath = path.join(sdBase, "access-config.json");
fs.writeFileSync(localCfgPath, JSON.stringify(accessConfig, null, 2), "utf8");
fs.writeFileSync(sdCfgPath, JSON.stringify(accessConfig, null, 2), "utf8");

// Ensure access-config.json is ignored by git
const gitignorePath = path.join(projectRoot, ".gitignore");
let gi = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, "utf8") : "";
if (!gi.includes("access-config.json")) {
gi = gi.trimEnd() + "\naccess-config.json\n";
fs.writeFileSync(gitignorePath, gi, "utf8");
}

// Starter notes & helpers per device folder
fs.writeFileSync(
path.join(sdBase, "windows-tor", "README-WINDOWS-TOR.txt"),
"Start Tor SOCKS5 on 127.0.0.1:9050 before opening MARAUDER-AI tools.\n",
"utf8"
);
fs.writeFileSync(
path.join(sdBase, "android-termux", "README-ANDROID-ORBOT.txt"),
"Enable Orbot, select MARAUDER-AI in app list, set Battery to Unrestricted.\n",
"utf8"
);
fs.writeFileSync(
path.join(sdBase, "flipper-scripts", "README-FLIPPER.txt"),
"Place Flipper-compatible scripts/assets here (no heavy desktop server runs on Flipper).\n",
"utf8"
);
fs.writeFileSync(
path.join(sdBase, "m5stack-notes", "README-M5STACK.txt"),
"Place M5Stack / Cardputer notes and sketches here.\n",
"utf8"
);

// Create access gate helper in public/access-gate.js
const gateJs = `(function(){
var KEY = "marauder_unlocked_session_v1";
if (sessionStorage.getItem(KEY) === "1") return;
var u = prompt("MARAUDER-AI Admin User:");
var p = prompt("MARAUDER-AI Access Key:");
if (!u || !p) {
document.body.innerHTML = "<div style='font-family:monospace;background:#09090b;color:#f87171;padding:24px;'>Достъпът е отказан. Презареди страницата за нов опит.</div>";
throw new Error("Access denied");
}
sessionStorage.setItem(KEY, "1");
})();
`;
fs.writeFileSync(path.join(pubSrc, "access-gate.js"), gateJs, "utf8");

console.log("SD_MARAUDER_SETUP_OK -> " + sdBase);
