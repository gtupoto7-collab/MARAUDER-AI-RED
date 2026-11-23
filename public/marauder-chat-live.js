(function () {
  const STORAGE_KEY = "MARAUDER_RED_CHAT_STATE_V3";
  const TTL_MS = 3 * 60 * 1000;

  const defaultState = {
    roomKey: "MRD-7XQ9-KL2F-8V6P",
    password: "zF9k-Qp3m-7H2v",
    secondsLeft: 180,
    operator: "MARAUDER-AL",
    activeEngine: "AUTO-READY",
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
        text: "Готов съм, MARAUDER-AL. Пиши команда или съобщение — ако няма интернет, минавам на Llama / локален режим.",
        ts: Date.now()
      }
    ]
  };

  function cloneDefault() {
    return JSON.parse(JSON.stringify(defaultState));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneDefault();
      return { ...cloneDefault(), ...JSON.parse(raw) };
    } catch {
      return cloneDefault();
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

  async function fetchWithTimeout(url, opts = {}, ms = 2200) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      return await fetch(url, { ...opts, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function generateSmartReply(prompt, st) {
    if (navigator.onLine) {
      try {
        const r = await fetchWithTimeout("/api/gangsta/forge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: prompt, operator: "MARAUDER-AL" })
        }, 2200);
        if (r.ok) {
          const d = await r.json();
          if (d && d.output) {
            st.activeEngine = "ONLINE-API";
            return `Mythos [ONLINE]: ${d.output.split("\n")[0]}`;
          }
        }
      } catch {}
    }

    for (const model of ["llama3.2", "llama3", "mistral"]) {
      try {
        const ol = await fetchWithTimeout("http://127.0.0.1:11434/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            prompt: `Ти си Mythos в конзолата MARAUDER. Оператор: MARAUDER-AL. Отговори кратко на български: ${prompt}`,
            stream: false
          })
        }, 2800);
        if (ol.ok) {
          const od = await ol.json();
          if (od && od.response) {
            st.activeEngine = `LOCAL-LLAMA (${model})`;
            return `Mythos [${model}]: ${od.response.trim()}`;
          }
        }
      } catch {}
    }

    st.activeEngine = "OFFLINE-CORE";
    return `Mythos [OFFLINE-AUTO]: Няма връзка към външен сървър/Ollama — обработих "${prompt}" локално за MARAUDER-AL.`;
  }

  function renderWidget(st) {
    let host = document.getElementById("mrd-live-chat-console");
    if (!host) {
      host = document.createElement("section");
      host.id = "mrd-live-chat-console";
      host.style.cssText = [
        "margin:12px auto",
        "max-width:1180px",
        "border:2px solid #dc2626",
        "border-radius:12px",
        "background:#0d1017",
        "color:#f3f4f6",
        "font-family:system-ui,sans-serif",
        "box-shadow:0 0 28px rgba(220,38,38,0.28)",
        "overflow:hidden"
      ].join(";");
      document.body.appendChild(host);
    }

    const msgsHtml = (st.messages || [])
      .map((m) => {
        const color = m.role === "mythos" ? "#38bdf8" : m.role === "human" ? "#fca5a5" : "#fbbf24";
        return `<div style="padding:8px 10px;border-bottom:1px solid #1f2937">
          <strong style="color:${color}">${m.sender}:</strong>
          <span style="white-space:pre-wrap">${m.text}</span>
        </div>`;
      })
      .join("");

    host.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding:14px 18px;background:linear-gradient(90deg,#7f1d1d,#18181b);border-bottom:1px solid #ef4444">
        <div>
          <div style="font-size:11px;letter-spacing:.12em;color:#fecaca;font-weight:700">OPERATOR: ${st.operator} | ENGINE: ${st.activeEngine}</div>
          <div style="font-size:22px;font-weight:900;color:#fff">RED-SECRET CHAT // LIVE AI CONSOLE</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <span id="mrd-chat-timer" style="padding:6px 10px;border-radius:6px;background:#090b10;border:1px solid #ef4444;font-weight:700;color:#f87171">${st.secondsLeft}s</span>
          <button id="mrd-new-key-btn" type="button" style="padding:8px 12px;border-radius:7px;border:1px solid #f87171;background:#991b1b;color:#fff;font-weight:700;cursor:pointer">NEW KEY</button>
          <button id="mrd-clear-chat-btn" type="button" style="padding:8px 12px;border-radius:7px;border:1px solid #4b5563;background:#1f2937;color:#fff;font-weight:700;cursor:pointer">CLEAR</button>
        </div>
      </div>
      <div style="padding:8px 18px;background:#111622;font-size:12px;color:#9ca3af;border-bottom:1px solid #1f2937">
        Room Key: <code style="color:#fff">${st.roomKey}</code> | Pass: <code style="color:#fff">${st.password}</code>
      </div>
      <div id="mrd-chat-feed" style="max-height:260px;overflow-y:auto;background:#090c12">${msgsHtml}</div>
      <form id="mrd-chat-form" style="display:flex;gap:8px;padding:12px;background:#111622;border-top:1px solid #1f2937">
        <input id="mrd-chat-input" type="text" placeholder="Напиши съобщение до Mythos / Llama..." style="flex:1;padding:10px 12px;border-radius:8px;border:1px solid #374151;background:#090c12;color:#fff;font-size:14px" />
        <button id="mrd-chat-send" type="submit" style="padding:10px 18px;border-radius:8px;border:0;background:#dc2626;color:#fff;font-weight:800;cursor:pointer">SEND</button>
      </form>
    `;

    const feed = document.getElementById("mrd-chat-feed");
    if (feed) feed.scrollTop = feed.scrollHeight;

    const form = document.getElementById("mrd-chat-form");
    const input = document.getElementById("mrd-chat-input");
    if (form && input) {
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const val = input.value.trim();
        if (!val) return;
        input.value = "";
        const next = await window.MARAUDER_CHAT_LIVE.sendMessage(val);
        renderWidget(next);
      });
    }

    const newKeyBtn = document.getElementById("mrd-new-key-btn");
    if (newKeyBtn) {
      newKeyBtn.addEventListener("click", async () => {
        const next = await window.MARAUDER_CHAT_LIVE.newKey();
        renderWidget(next);
      });
    }

    const clearBtn = document.getElementById("mrd-clear-chat-btn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        const cur = window.MARAUDER_CHAT_LIVE.getState();
        cur.messages = [];
        saveState(cur);
        renderWidget(cur);
      });
    }
  }

  function detachChatFromMarketplace() {
    for (const el of document.querySelectorAll("a, button, div, span")) {
      const txt = (el.textContent || "").trim().toUpperCase();
      if (txt === "MARKETPLACE") {
        el.dataset.mrdMarketplaceClean = "1";
      }
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
      const a = Math.random().toString(36).slice(2, 6).toUpperCase();
      const b = Math.random().toString(36).slice(2, 6).toUpperCase();
      st.roomKey = `MRD-${a}-${b}-8V6P`;
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
        id: "u-" + Date.now(),
        sender: "MARAUDER-AL",
        role: "human",
        text: clean,
        ts: Date.now()
      });
      const reply = await generateSmartReply(clean, st);
      st.messages.push({
        id: "m-" + Date.now(),
        sender: "AI Agent (Mythos)",
        role: "mythos",
        text: reply,
        ts: Date.now()
      });
      saveState(st);
      return st;
    },
    openChat() {
      const el = document.getElementById("mrd-live-chat-console");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      const inp = document.getElementById("mrd-chat-input");
      if (inp) inp.focus();
    }
  };

  function boot() {
    detachChatFromMarketplace();
    renderWidget(window.MARAUDER_CHAT_LIVE.getState());
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  setInterval(() => {
    const st = window.MARAUDER_CHAT_LIVE.getState();
    st.secondsLeft = st.secondsLeft > 1 ? st.secondsLeft - 1 : 180;
    saveState(st);
    const t = document.getElementById("mrd-chat-timer");
    if (t) t.textContent = `${st.secondsLeft}s`;
  }, 1000);
})();
