#!/usr/bin/env bash
set -e
sudo apt-get update -y && sudo apt-get install -y git nodejs npm curl
rm -rf MARAUDER-AI-RED
git clone https://github.com/gtupoto7-collab/MARAUDER-AI-RED.git
cd MARAUDER-AI-RED
npm install --omit=dev 2>/dev/null || true
echo "UBUNTU READY: cd MARAUDER-AI-RED && node scripts/gangsta-demon.js"
