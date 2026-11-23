#!/data/data/com.termux/files/usr/bin/bash
set -e
pkg update -y && pkg install -y git nodejs curl
rm -rf MARAUDER-AI-RED
git clone https://github.com/gtupoto7-collab/MARAUDER-AI-RED.git
cd MARAUDER-AI-RED
npm install --omit=dev 2>/dev/null || true
echo "TERMUX READY: cd MARAUDER-AI-RED && node scripts/gangsta-demon.js"
