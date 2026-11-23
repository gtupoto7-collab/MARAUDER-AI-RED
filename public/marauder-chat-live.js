(function () {
  const STORAGE_KEY = "MARAUDER_RED_CHAT_STATE_V1";
  const TTL_MS = 3 * 60 * 1000;

  const defaultState = {
    roomKey: "MRD-7XQ9-KL2F-8V6P",
    password: "zF9k-Qp3m-7H2v",
    secondsLeft: 180,
    operator: "MARAUDER-AL",
    messages: [
      {
        id: "m-1",
        sender: "MARAUDER",
        role: "system",
        text: "Секретен чат е активиран! Съобщенията ще се изтрият след 3 минути.",
        ts: Date.now()
      },
      {
        id: "m-2",
        sender: "AI Agent (Mythos)",
        role: "mythos",
        text: "Готов съм. Кажи ми какво искаш да направим?",
        ts: Date.now()
      },
      {
        id: "m-3",
        sender: "MARAUDER-AL",
        role: "human",
        text: "Изпращам ти снимка и видео...",
        ts: Date.now()
      }
    ]
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(defaultState);
      const parsed = JSON.parse(raw);
      return { ...structuredClone(defaultState), ...parsed };
    } catch {
      return structuredClone(defaultState);
    }
  }

  function saveState(st) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
    } catch {}
  }

  function purgeOld(st) {
    const now = Date.now();
    st.messages = (st.messages || []).filter((m) => now - (m.ts || now) < TTL_MS);
    return st;
  }

  async function askMythosBackend(prompt) {
    try {
      const r = await fetch("/api/gangsta/forge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: prompt })
      });
      if (r.ok) {
        const d = await r.json();
        if (d && d.output) {
          const line = d.output.split("\n").find((x) => x.startsWith("ENGINE:")) || "MYTHOS READY";
          return `Mythos (${line}): Обработих "${prompt}" — системата е активна.`;
        }
      }
    } catch {}
    return `Mythos: Потвърждавам командата "${prompt}". Всички модули са на линия.`;
  }

  window.MARAUDER_CHAT_LIVE = {
    getState() {
      const st = purgeOld(loadState());
      saveState(st);
      return st;
    },
    async newKey() {
      const st = this.getState();
      try {
        const r = await fetch("/api/gangsta/secret/key", { method: "POST" });
        if (r.ok) {
          const d = await r.json();
          if (d.key && d.password) {
            st.roomKey = d.key;
            st.password = d.password;
            st.secondsLeft = d.ttlSeconds || 180;
            saveState(st);
            return st;
          }
        }
      } catch {}
      const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
      st.roomKey = `MRD-${rand}-RED`;
      st.password = Math.random().toString(36).slice(2, 12);
      st.secondsLeft = 180;
      saveState(st);
      return st;
    },
    async sendMessage(text, target = "both") {
      const clean = String(text || "").trim();
      if (!clean) return this.getState();
      const st = this.getState();
      st.messages.push({
        id: "msg-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        sender: "MARAUDER-AL",
        role: "human",
        text: clean,
        ts: Date.now()
      });

      try {
        await fetch("/api/gangsta/secret/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomKey: st.roomKey,
            password: st.password,
            sender: "MARAUDER-AL",
            text: clean
          })
        });
      } catch {}

      if (target === "mythos" || target === "both") {
        const reply = await askMythosBackend(clean);
        st.messages.push({
          id: "mythos-" + Date.now(),
          sender: "AI Agent (Mythos)",
          role: "mythos",
          text: reply,
          ts: Date.now()
        });
      }

      saveState(st);
      return st;
    },
    clearExpired() {
      const st = purgeOld(loadState());
      saveState(st);
      return st;
    }
  };

  setInterval(() => {
    window.MARAUDER_CHAT_LIVE.clearExpired();
  }, 5000);
})();
