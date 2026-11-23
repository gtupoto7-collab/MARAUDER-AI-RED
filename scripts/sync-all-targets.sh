#!/usr/bin/env bash
set -e
cd /mnt/c/Users/gtupo/marauder-ai-web
mkdir -p public/downloads

if [ -f /mnt/c/Users/gtupo/Downloads/MARAUDER-AI-Windows.zip ]; then
  cp /mnt/c/Users/gtupo/Downloads/MARAUDER-AI-Windows.zip public/downloads/MARAUDER-AI-Windows.zip
fi

if [ -f /mnt/c/Users/gtupo/Downloads/MARAUDER-AI-signed.apk ]; then
  cp /mnt/c/Users/gtupo/Downloads/MARAUDER-AI-signed.apk public/downloads/MARAUDER-AI-Android.apk
elif [ -f /mnt/c/Users/gtupo/Desktop/MARAUDER-AI-1.apk ]; then
  cp /mnt/c/Users/gtupo/Desktop/MARAUDER-AI-1.apk public/downloads/MARAUDER-AI-Android.apk
fi

[ -f scripts/install-termux.sh ] && cp scripts/install-termux.sh public/downloads/MARAUDER-AI-Termux.sh
[ -f scripts/install-ubuntu.sh ] && cp scripts/install-ubuntu.sh public/downloads/MARAUDER-AI-Ubuntu.sh

cat << 'JSON' > public/downloads/release-manifest.json
{
  "project": "MARAUDER-AI",
  "repo": "https://github.com/gtupoto7-collab/MARAUDER-AI-RED.git",
  "targets": {
    "windows": "/downloads/MARAUDER-AI-Windows.zip",
    "android": "/downloads/MARAUDER-AI-Android.apk",
    "iosInfo": "/downloads/MARAUDER-AI-iOS-INFO.txt",
    "termux": "/downloads/MARAUDER-AI-Termux.sh",
    "ubuntu": "/downloads/MARAUDER-AI-Ubuntu.sh"
  }
}
JSON

ls -lh public/downloads/
git add routes/payment-key-api.js public/camouflage-gate.js scripts/sync-all-targets.sh public/downloads/
git commit -m "Level up automation: payment key API, camouflage gate and multi-platform targets" || true
git push origin main
