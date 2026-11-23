const express = require("express");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const secretChat = require("../modules/secret-chat-engine");

const router = express.Router();
const rootDir = path.join(__dirname, "..");

router.get("/gangsta/status", (req, res) => {
  const demonPath = path.join(rootDir, "public", "api", "demon-state.json");
  const statusPath = path.join(rootDir, "public", "api", "console-status.json");
  const demon = fs.existsSync(demonPath) ? JSON.parse(fs.readFileSync(demonPath, "utf8")) : null;
  const consoleStatus = fs.existsSync(statusPath) ? JSON.parse(fs.readFileSync(statusPath, "utf8")) : null;
  res.json({ ok: true, demon, consoleStatus });
});

router.post("/gangsta/secret/key", (req, res) => {
  res.json({ ok: true, ...secretChat.generateCredentials() });
});

router.post("/gangsta/secret/send", (req, res) => {
  try {
    const { roomKey, password, sender, text } = req.body || {};
    if (!roomKey || !password || !text) {
      return res.status(400).json({ ok: false, error: "roomKey, password and text are required" });
    }
    const result = secretChat.postSecretMessage(roomKey, password, sender, text);
    res.json(result);
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/gangsta/secret/read", (req, res) => {
  try {
    const { roomKey, password } = req.body || {};
    if (!roomKey || !password) {
      return res.status(400).json({ ok: false, error: "roomKey and password are required" });
    }
    const messages = secretChat.readSecretMessages(roomKey, password);
    res.json({ ok: true, messages });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.post("/gangsta/forge", (req, res) => {
  try {
    const topic = String((req.body && req.body.topic) || "MARAUDER FORGE RUN").replace(/"/g, "");
    const out = execSync(`node scripts/gangsta-forge.js report "${topic}"`, { cwd: rootDir }).toString().trim();
    res.json({ ok: true, output: out });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/gangsta/local-hub", (req, res) => {
  const hubPath = path.join(rootDir, "public", "api", "local-hub.json");
  const hub = fs.existsSync(hubPath) ? JSON.parse(fs.readFileSync(hubPath, "utf8")) : null;
  res.json({ ok: true, hub });
});

module.exports = router;
