#!/usr/bin/env bash
set -e

REPO_DIR="/mnt/c/Users/gtupo/marauder-ai-web"
BOT_DIR="$HOME/marauder-tg-live-bot"
COMMIT_MSG="${1:-Sync unified update across Windows, Android, iOS, and Telegram}"
APP_URL="https://marauder-ai-hacker.onrender.com"
GIFT_KEY="RST-AI-001"
BOT_HANDLE="@marauderai_bot"

cd "$REPO_DIR"

echo "[1/5] Cleaning temporary .bak files..."
rm -f server.js.bak public/index.html.bak public/secret-chat.html.bak public/bot-builder.html.bak
if [ -d "$BOT_DIR" ]; then
  rm -f "$BOT_DIR"/*.bak
fi

echo "[2/5] Checking Telegram bot syntax ($BOT_DIR/bot-live.js)..."
if [ -f "$BOT_DIR/bot-live.js" ]; then
  node --check "$BOT_DIR/bot-live.js"
fi

echo "[3/5] Updating unified release manifest for Windows, iOS, Android & Telegram..."
mkdir -p "$REPO_DIR/public/downloads"
cat << JSON > "$REPO_DIR/public/downloads/release-manifest.json"
{
  "app": "MARAUDER-AI",
  "owner": "RED-SOFTWARE-TEAM-BG",
  "mainBot": "$BOT_HANDLE",
  "webAndMiniAppUrl": "$APP_URL",
  "giftAccessKey": "$GIFT_KEY",
  "updatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "targets": {
    "windows": "$APP_URL",
    "android": "$APP_URL",
    "ios": "$APP_URL",
    "telegramMiniApp": "$APP_URL"
  }
}
JSON

echo "[4/5] Checking key markers in public/*.html..."
for f in public/index.html public/secret-chat.html public/bot-builder.html; do
  if [ -f "$f" ]; then
    grep -q "marauderai_bot" "$f" || echo "WARN: missing marauderai_bot in $f"
    grep -q "RST-AI-001" "$f" || echo "WARN: missing RST-AI-001 in $f"
  fi
done

echo "[5/5] Committing and pushing to origin/main..."
git add -A
if ! git diff --cached --quiet; then
  git commit -m "$COMMIT_MSG"
fi
git push origin main
git status -s
echo "DONE: Unified update pushed for Windows, Android, iOS & Telegram."
