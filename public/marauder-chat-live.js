(function () {
  const STORAGE_KEY = "MARAUDER_RED_CHAT_STATE_V2";
  const TTL_MS = 3 * 60 * 1000;

  const defaultState = {
    roomKey: "MRD-7XQ9-KL2F-8V6P",
    password: "zF9k-Qp3m-7H2v",
    secondsLeft: 180,
    operator: "MARAUDER-AL",
    activeEngine: "AUTO",
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
      return { ...structuredClone(defaultState), ...JSON.parse(raw) };
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

  async function fetchWithTimeout(url, opts = {}, ms = 2500) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { ...opts, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function generateSmartReply(prompt, st) {
    // 1. Online / Backend API
    if (navigator.onLine) {
      try {
        const r = await fetchWithTimeout("/api/gangsta/forge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: prompt, operator: "MARAUDER-AL" })
        }, 2500);
        if (r.ok) {
          const d = await r.json();
          if (d && d.output) {
            st.activeEngine = "ONLINE-API";
            return `Mythos [ONLINE]: ${d.output.split("\n")[0]} — "${prompt}" е изпълнено.`;
          }
        }
      } catch {}
    }

    // 2. Local Ollama / Llama fallback (ako nqma net ili Render ne otgovarq)
    for (const model of ["llama3.2", "llama3", "mistral"]) {
      try {
        const ol = await fetchWithTimeout("http://127.0.0.1:11434/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            prompt: `Ти си Mythos AI в конзолата MARAUDER. Операторът е MARAUDER-AL. Отговори кратко и директно на български на: ${prompt}`,
            stream: false
          })
        }, 3000);
        if (ol.ok) {
          const od = await ol.json();
          if (od && od.response) {
            st.activeEngine = `LOCAL-LLAMA (${model})`;
            return `Mythos [${model} / OFFLINE-NET]: ${od.response.trim()}`;
          }
        }
      } catch {}
    }

    // 3. Pure Offline fallback (nqma net i nqma aktiven Ollama port)
    st.activeEngine = "OFFLINE-CORE";
    return `Mythos [OFFLINE-AUTO]: Няма външна мрежа — превключих на автономен режим за MARAUDER-AL по команда: "${prompt}".`;
  }

  function boostChatOptionAndDetachMarketplace() {
    const allEls = Array.from(document.querySelectorAll("a, button, div, span, [role='button']"));

    // Mahame chat trigger-i ot MARKETPLACE i gi vodim kum chata
    for (const el of allEls) {
      const t = (el.textContent || "").trim().toUpperCase();
      if (t === "MARKETPLACE" || t.startsWith("MARKETPLACE")) {
        el.dataset.mrdMarketplaceClean = "1";
        el.addEventListener("click", () => {
          const chatBox = document.querySelector("[data-mrd-chat-zone], #red-secret-chat, .red-secret-chat");
          if (chatBox && chatBox.contains(el)) {
            chatBox.dataset.mrdChatZone = "1";
          }
        }, true);
      }
    }

    // Pravim brutalna golema opciq s nadpis za chata
    if (!document.getElementById("mrd-brutal-chat-banner")) {
      const banner = document.createElement("div");
      banner.id = "mrd-brutal-chat-banner";
      banner.style.cssText = [
        "margin:8px 0",
        "padding:14px 18px",
        "border-radius:10px",
        "border:2px solid #ef4444",
        "background:linear-gradient(90deg, rgba(127,29,29,0.55), rgba(20,20,28,0.95))",
        "box-shadow:0 0 24px rgba(239,68,68,0.35)",
        "display:flex",
        "align-items:center",
        "justify-content:space-between",
        "gap:12px",
        "cursor:pointer"
      ].join(";");

      banner.innerHTML = `
        <div>
          <div style="font-size:11px;letter-spacing:.12em;color:#fca5a5;font-weight:700">MARAUDER-AL // LIVE COMMAND LINK</div>
          <div style="font-size:20px;font-weight:900;color:#ffffff;letter-spacing:.04em">RED-SECRET CHAT — FULL AI & LLAMA CONSOLE</div>
        </div>
        <button id="mrd-focus-chat-btn" type="button" style="padding:10px 16px;border-radius:8px;border:1px solid #f87171;background:#dc2626;color:#fff;font-weight:800;cursor:pointer">OPEN CHAT MAX</button>
      `;

      const anchor = document.querySelector("#red-secret-chat, .red-secret-chat, [class*='secret-chat'], main") || document.body;
      if (anchor === document.body) {
        document.body.prepend(banner);
      } else {
        anchor.prepend(banner);
      }

      const focusChat = () => {
        const input = document.querySelector("textarea, input[placeholder*='съобщ'], input[placeholder*='message'], input[type='text']");
        if (input) {
          input.scrollIntoView({ behavior: "smooth", block: "center" });
          input.focus();
        }
      };

      banner.addEventListener("click", focusChat);
      const bBtn = document.getElementById("mrd-focus-chat-btn");
      if (bBtn) bBtn.addEventListener("click", (e) => { e.stopPropagation(); focusChat(); });
    }
  }

  window.MARAUDER_CHAT_LIVE = {
    getState() {
      const st = purgeOld(loadState());
      saveState(st);
      return st;
    },
    async newKey() {
      const st = this.getState();
      const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
      const rand2 = Math.random().toString(36).slice(2, 6).toUpperCase();
      st.roomKey = `MRD-${rand}-${rand2}-8V6P`;
      st.password = Math.random().toString(36).slice(2, 6) + "-" + Math.random().toString(36).slice(2, 7);
      st.secondsLeft = 180;
      saveState(st);
      return st;
    },
    async sendMessage(text) {
      const clean = String(text || "").trim();
      if (!clean) return this.getState();
      const st = this.getState();
      st.messages.push({
        id: "msg-" + Date.now(),
        sender: "MARAUDER-AL",
        role: "human",
        text: clean,
        ts: Date.now()
      });

      const reply = await generateSmartReply(clean, st);
      st.messages.push({
        id: "mythos-" + Date.now(),
        sender: "AI Agent (Mythos)",
        role: "mythos",
        text: reply,
        ts: Date.now()
      });

      saveState(st);
      return st;
    },
    clearExpired() {
      const st = purgeOld(loadState());
      saveState(st);
      return st;
    }
  };

  const init = () => {
    boostChatOptionAndDetachMarketplace();
    window.MARAUDER_CHAT_LIVE.clearExpired();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  setInterval(() => {
    window.MARAUDER_CHAT_LIVE.clearExpired();
  }, 5000);
})();
