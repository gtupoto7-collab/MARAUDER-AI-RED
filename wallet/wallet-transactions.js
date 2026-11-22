(function () {
  const PAYPAL_URL = "https://www.paypal.com/ncp/payment/RPTDVVN5XA4XC";
  const LOG_KEY = "marauder_real_wallet_log_v1";

  function loadLog() {
    try { return JSON.parse(localStorage.getItem(LOG_KEY) || "[]"); } catch (_) { return []; }
  }
  function saveLog(items) {
    try { localStorage.setItem(LOG_KEY, JSON.stringify(items.slice(0, 40))); } catch (_) {}
  }

  function renderLog() {
    const box = document.getElementById("mw-activity-log");
    if (!box) return;
    const items = loadLog();
    if (!items.length) {
      box.innerHTML = "<div class=\"muted\">Няма записани събития още.</div>";
      return;
    }
    box.innerHTML = items.map((it) =>
      "<div class=\"log-item\"><strong>[" + it.type + "]</strong> " + it.text +
      " <span class=\"muted\">(" + it.time + ")</span></div>"
    ).join("");
  }

  function addLog(type, text) {
    const items = loadLog();
    items.unshift({ type, text, time: new Date().toLocaleTimeString() });
    saveLog(items);
    renderLog();
  }

  async function renderQr(text) {
    const wrap = document.getElementById("mw-qr-box");
    if (!wrap) return;
    try {
      const res = await fetch("/api/portfolio/qr?text=" + encodeURIComponent(text));
      if (res.ok && (res.headers.get("content-type") || "").includes("svg")) {
        wrap.innerHTML = await res.text();
        return;
      }
    } catch (_) {}
    const img = "https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=" + encodeURIComponent(text);
    wrap.innerHTML = "<img src=\"" + img + "\" alt=\"QR\" width=\"160\" height=\"160\" style=\"background:#fff;padding:4px;border-radius:6px;\" />";
  }

  window.MarauderWalletTx = {
    addLog,
    renderLog,
    init: function () {
      renderLog();
      const checkBtn = document.getElementById("mw-ton-check");
      if (checkBtn) {
        checkBtn.addEventListener("click", async () => {
          const addr = window.MarauderWalletConnect.getAddress();
          const balEl = document.getElementById("mw-ton-balance");
          const addrEl = document.getElementById("mw-ton-addr");
          if (addrEl) addrEl.textContent = addr;
          if (balEl) balEl.textContent = "TON: зареждам...";
          try {
            const info = await window.MarauderWalletConnect.fetchTonBalance(addr);
            if (balEl) balEl.textContent = "TON: " + info.balanceTon.toFixed(4);
            addLog("TON_BALANCE", addr + " -> " + info.balanceTon.toFixed(4) + " TON (" + info.source + ")");
          } catch (err) {
            if (balEl) balEl.textContent = "TON: грешка при четене";
            addLog("TON_ERROR", err.message || "Грешка");
          }
        });
      }

      const prepBtn = document.getElementById("mw-ton-prepare");
      if (prepBtn) {
        prepBtn.addEventListener("click", () => {
          const to = ((document.getElementById("mw-ton-to") || {}).value || "").trim();
          const amt = Number(((document.getElementById("mw-ton-amount") || {}).value || "0"));
          const prev = document.getElementById("mw-ton-tx-preview");
          if (!to || !(amt > 0)) {
            if (prev) prev.textContent = "Въведи валиден получател и сума > 0.";
            return;
          }
          const nano = Math.round(amt * 1e9);
          const deepLink = "ton://transfer/" + encodeURIComponent(to) + "?amount=" + nano;
          if (prev) prev.textContent = "Готово за подпис в Keeper/Tonkeeper: " + deepLink;
          addLog("TON_TX_DRAFT", amt + " TON -> " + to + " (" + deepLink + ")");
        });
      }

      const copyPp = document.getElementById("mw-copy-paypal");
      if (copyPp) {
        copyPp.addEventListener("click", async () => {
          try { await navigator.clipboard.writeText(PAYPAL_URL); } catch (_) {}
          addLog("PAYPAL_LINK", "Копиран официален PayPal NCP линк: " + PAYPAL_URL);
        });
      }

      const qrPp = document.getElementById("mw-qr-paypal");
      if (qrPp) {
        qrPp.addEventListener("click", () => {
          renderQr(PAYPAL_URL);
          addLog("PAYPAL_QR", "Показан QR код за PayPal NCP линка");
        });
      }

      const clearBtn = document.getElementById("mw-clear-log");
      if (clearBtn) {
        clearBtn.addEventListener("click", () => {
          saveLog([]);
          renderLog();
        });
      }
    }
  };
})();
