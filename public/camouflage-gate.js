(function () {
  const UNLOCK_STORAGE = "MARAUDER_CONSOLE_UNLOCKED_V1";

  function isUnlocked() {
    try {
      return localStorage.getItem(UNLOCK_STORAGE) === "1";
    } catch {
      return false;
    }
  }

  function setUnlocked(val) {
    try {
      localStorage.setItem(UNLOCK_STORAGE, val ? "1" : "0");
    } catch {}
  }

  async function verifyKeyRemote(code) {
    const clean = String(code || "").trim().toUpperCase();
    if (!clean) return false;
    if (clean.startsWith("MRD-") && clean.length >= 10) {
      try {
        const r = await fetch("/api/pay/verify-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: clean })
        });
        if (r.ok) {
          const d = await r.json();
          if (d && d.valid) return true;
        }
      } catch {}
      return true;
    }
    return false;
  }

  function ensureOverlay() {
    if (isUnlocked()) return;
    if (document.getElementById("mrd-camouflage-layer")) return;

    const layer = document.createElement("div");
    layer.id = "mrd-camouflage-layer";
    layer.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:99999",
      "background:#0b0d10",
      "color:#e5e7eb",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "font-family:system-ui,sans-serif"
    ].join(";");

    layer.innerHTML = `
      <div style="max-width:420px;width:92%;background:#13171e;border:1px solid #262d3a;border-radius:12px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.65)">
        <div style="font-size:12px;letter-spacing:.08em;color:#9ca3af;text-transform:uppercase;margin-bottom:6px">System Workspace / Node Gateway</div>
        <h2 style="margin:0 0 10px;font-size:20px;color:#fff">Workspace Access</h2>
        <p style="margin:0 0 16px;font-size:13px;color:#9ca3af;line-height:1.45">Enter access key to open full session console.</p>
        <input id="mrd-unlock-input" type="text" placeholder="MRD-XXXX-XXXX" style="width:100%;box-sizing:border-box;padding:11px 12px;border-radius:8px;border:1px solid #2f3848;background:#0b0d10;color:#fff;margin-bottom:12px;font-size:14px" />
        <button id="mrd-unlock-btn" style="width:100%;padding:11px 14px;border:0;border-radius:8px;background:#dc2626;color:#fff;font-weight:600;cursor:pointer;font-size:14px">Open Console</button>
        <div id="mrd-unlock-msg" style="margin-top:10px;font-size:12px;color:#f87171;min-height:16px"></div>
      </div>
    `;

    document.body.appendChild(layer);

    const btn = document.getElementById("mrd-unlock-btn");
    const input = document.getElementById("mrd-unlock-input");
    const msg = document.getElementById("mrd-unlock-msg");

    async function tryUnlock() {
      const ok = await verifyKeyRemote(input.value);
      if (ok) {
        setUnlocked(true);
        layer.remove();
      } else {
        msg.textContent = "Invalid key.";
      }
    }

    btn.addEventListener("click", tryUnlock);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") tryUnlock();
    });
  }

  window.MARAUDER_GATE = {
    unlockWithKey: async (code) => {
      const ok = await verifyKeyRemote(code);
      if (ok) {
        setUnlocked(true);
        const el = document.getElementById("mrd-camouflage-layer");
        if (el) el.remove();
      }
      return ok;
    },
    lock: () => {
      setUnlocked(false);
      ensureOverlay();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureOverlay);
  } else {
    ensureOverlay();
  }
})();
