"use strict";

const { createMarauderBotEngine } = require("../routes/marauder-bot");

const token = String(process.env.TELEGRAM_BOT_TOKEN || process.argv[2] || "").trim();
if (!token) {
  console.error("Missing TELEGRAM_BOT_TOKEN. Run with: TELEGRAM_BOT_TOKEN=\"...\" node scripts/poll-marauder-bot.js");
  process.exit(1);
}

const bot = createMarauderBotEngine({ token });
let offset = Number(process.env.BOT_OFFSET || 0);
let running = true;

process.on("SIGINT", () => {
  running = false;
  console.log("\nStopping @marauderai_bot live poller...");
});

(async () => {
  console.log("Live polling started for @marauderai_bot (Ctrl+C to stop)...");
  while (running) {
    try {
      const res = await bot.pollOnce(token, offset);
      if (res.ok) {
        offset = res.nextOffset;
        if (res.processed.length > 0) {
          console.log(JSON.stringify({ at: new Date().toISOString(), offset, processed: res.processed }));
        }
      } else {
        console.error("Poll warning:", res);
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (err) {
      console.error("Poll error:", err.message || err);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
})();
