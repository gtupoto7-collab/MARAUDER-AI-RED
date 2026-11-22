const fs = require("fs");
const path = require("path");

const pubDir = path.join(__dirname, "..", "public");
const idxPath = path.join(pubDir, "index.html");
if (!fs.existsSync(idxPath)) {
console.error("Missing public/index.html");
process.exit(1);
}

let idx = fs.readFileSync(idxPath, "utf8");
idx = idx.replace(/openSeparateWindow\("\/kali-root\.html#vpn"\)/g, 'openSeparateWindow("/orbot-vpn.html")');
if (!idx.includes("/orbot-vpn.html") && idx.includes('href="/downloads.html"')) {
idx = idx.replace(
'href="/downloads.html"',
'href="/orbot-vpn.html" style="display:block;padding:5px 10px;color:#c084fc;text-decoration:none;font-size:12px;">Orbot &amp; VPN Bridge (/orbot-vpn.html)</a><a href="/downloads.html"'
);
}
fs.writeFileSync(idxPath, idx, "utf8");
console.log("PATCH_INDEX_OK");
