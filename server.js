const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const chatRoom = {
token: null,
expiresAt: 0,
roomOpen: false,
maxUsers: 150,
messages: [],
lastWipeAt: Date.now()
};

function clearExpiredToken() {
if (chatRoom.token && Date.now() > chatRoom.expiresAt) {
chatRoom.token = null;
chatRoom.expiresAt = 0;
}
}

function runAutoWipeIfNeeded() {
if (Date.now() - chatRoom.lastWipeAt >= 120000) {
chatRoom.messages = [];
chatRoom.lastWipeAt = Date.now();
}
}

setInterval(() => {
clearExpiredToken();
runAutoWipeIfNeeded();
}, 1000);

function randomCode7() {
const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const bytes = crypto.randomBytes(7);
let out = "";
for (let i = 0; i < 7; i++) {
out += chars[bytes[i] % chars.length];
}
return out;
}

app.post("/api/secret-chat/generate", (req, res) => {
clearExpiredToken();
runAutoWipeIfNeeded();
chatRoom.token = randomCode7();
chatRoom.expiresAt = Date.now() + 30000;
chatRoom.roomOpen = true;
res.json({
ok: true,
token: chatRoom.token,
expiresInSec: Math.max(0, Math.ceil((chatRoom.expiresAt - Date.now()) / 1000)),
roomOpen: chatRoom.roomOpen
});
});

app.post("/api/secret-chat/join", (req, res) => {
clearExpiredToken();
runAutoWipeIfNeeded();
const entered = String((req.body && req.body.token) || "").trim().toUpperCase();
if (!chatRoom.token || !entered || entered !== chatRoom.token) {
return res.status(400).json({
  ok: false,
  error: "INVALID OR EXPIRED TOKEN (30s lifetime)."
});
}
chatRoom.roomOpen = true;
res.json({
ok: true,
roomOpen: true,
expiresInSec: Math.max(0, Math.ceil((chatRoom.expiresAt - Date.now()) / 1000)),
messages: chatRoom.messages
});
});

app.get("/api/secret-chat/state", (req, res) => {
clearExpiredToken();
runAutoWipeIfNeeded();
const wipeElapsed = Math.floor((Date.now() - chatRoom.lastWipeAt) / 1000);
const wipeInSec = 120 - (wipeElapsed % 120);
res.json({
ok: true,
token: chatRoom.token,
expiresInSec: chatRoom.token ? Math.max(0, Math.ceil((chatRoom.expiresAt - Date.now()) / 1000)) : 0,
roomOpen: chatRoom.roomOpen,
maxUsers: chatRoom.maxUsers,
wipeInSec: wipeInSec === 0 ? 120 : wipeInSec,
messages: chatRoom.messages
});
});

app.post("/api/secret-chat/send", (req, res) => {
clearExpiredToken();
runAutoWipeIfNeeded();
if (!chatRoom.roomOpen) {
return res.status(403).json({ ok: false, error: "Room is closed." });
}
const text = String((req.body && req.body.text) || "").trim();
const device = String((req.body && req.body.device) || "ANON").slice(0, 16);
if (!text) {
return res.status(400).json({ ok: false, error: "Empty message." });
}
const entry = `[${new Date().toLocaleTimeString("bg-BG")}] [${device}] ${text}`;
chatRoom.messages.push(entry);
if (chatRoom.messages.length > 300) {
chatRoom.messages = chatRoom.messages.slice(-300);
}
res.json({ ok: true, messages: chatRoom.messages });
});

app.post("/api/secret-chat/wipe", (req, res) => {
chatRoom.messages = [];
chatRoom.lastWipeAt = Date.now();
res.json({ ok: true, messages: [] });
});

app.post("/api/secret-chat/close", (req, res) => {
chatRoom.roomOpen = false;
chatRoom.messages = [];
chatRoom.token = null;
chatRoom.expiresAt = 0;
res.json({ ok: true, roomOpen: false });
});

app.get("*", (req, res) => {
res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
console.log("MARAUDER server listening on port", PORT);
});
