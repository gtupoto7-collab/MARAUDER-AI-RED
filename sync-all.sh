#!/usr/bin/env bash
set -e

REPO_DIR="/mnt/c/Users/gtupo/marauder-ai-web"
BOT_DIR="$HOME/marauder-tg-live-bot"
COMMIT_MSG="${1:-Sync unified update across Windows, Android, iOS, and Telegram}"
APP_URL="${MINI_APP_URL:-https://marauder-ai-hacker.onrender.com}"
GIFT_KEY="${GIFT_ACCESS_KEY:-RST-AI-001}"
BOT_HANDLE="@marauderai_bot"
PID_FILE="$BOT_DIR/bot-live.pid"
LOG_FILE="$BOT_DIR/bot-live.log"

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] && [ -f "$BOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$BOT_DIR/.env"
  set +a
fi

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ]; then
  EXISTING_CMD=$(ps -ef | grep "[n]ode bot-live.js" | head -n 1 || true)
  if [ -n "$EXISTING_CMD" ]; then
    EXTRACTED_TOKEN=$(printf '%s\n' "$EXISTING_CMD" | sed -n 's/.*TELEGRAM_BOT_TOKEN=\([^ ]*\).*/\1/p')
    if [ -n "$EXTRACTED_TOKEN" ]; then
      TELEGRAM_BOT_TOKEN="$EXTRACTED_TOKEN"
    fi
  fi
fi

cd "$REPO_DIR"

echo "[1/6] Cleaning temporary .bak files..."
rm -f server.js.bak public/index.html.bak public/secret-chat.html.bak public/bot-builder.html.bak sync-all.sh.bak
if [ -d "$BOT_DIR" ]; then
  rm -f "$BOT_DIR"/*.bak
fi

echo "[2/6] Checking Telegram bot syntax ($BOT_DIR/bot-live.js)..."
if [ -f "$BOT_DIR/bot-live.js" ]; then
  node --check "$BOT_DIR/bot-live.js"
fi

echo "[3/6] Updating unified release manifest for Windows, iOS, Android & Telegram..."
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

echo "[4/6] Checking key markers in public/*.html..."
for f in public/index.html public/secret-chat.html public/bot-builder.html; do
  if [ -f "$f" ]; then
    grep -q "marauderai_bot" "$f" || echo "WARN: missing marauderai_bot in $f"
    grep -q "RST-AI-001" "$f" || echo "WARN: missing RST-AI-001 in $f"
  fi
done

echo "[5/6] Committing and pushing to origin/main..."
git add -A
if ! git diff --cached --quiet; then
  git commit -m "$COMMIT_MSG"
fi
git push origin main

echo "[6/6] Restarting Telegram bot ($BOT_DIR/bot-live.js)..."
if [ -f "$BOT_DIR/bot-live.js" ]; then
  if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE" 2>/dev/null || true)
    if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
      kill "$OLD_PID" 2>/dev/null || true
      sleep 1
    fi
    rm -f "$PID_FILE"
  fi
  OLD_PIDS=$(pgrep -f "node bot-live.js" || true)
  if [ -n "$OLD_PIDS" ]; then
    for p in $OLD_PIDS; do
      kill "$p" 2>/dev/null || true
    done
    sleep 1
  fi

  cd "$BOT_DIR"
  TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}" \
  MINI_APP_URL="$APP_URL" \
  PING_TARGET_URL="${PING_TARGET_URL:-$APP_URL}" \
  PING_INTERVAL_MS="${PING_INTERVAL_MS:-20000}" \
  nohup node bot-live.js >> "$LOG_FILE" 2>&1 < /dev/null &
  NEW_PID=$!
  echo "$NEW_PID" > "$PID_FILE"
  sleep 1
  if kill -0 "$NEW_PID" 2>/dev/null; then
    echo "Bot restarted cleanly (PID: $NEW_PID, log: $LOG_FILE)"
  else
    echo "WARN: Check $LOG_FILE — bot process exited"
  fi
fi

cd "$REPO_DIR"
git status -s
echo "DONE: Unified update pushed and bot restarted."
