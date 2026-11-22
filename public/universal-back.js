(function () {
  if (window.__marauderUniversalBackLoaded) return;
  window.__marauderUniversalBackLoaded = true;

  var style = document.createElement("style");
  style.textContent = [
    ".m-back-bar{position:sticky;top:0;z-index:99999;display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(9,11,16,0.95);border-bottom:1px solid #00f5d4;backdrop-filter:blur(6px);font-family:monospace;}",
    ".m-back-btn{cursor:pointer;background:#111827;color:#00f5d4;border:1px solid #00f5d4;border-radius:6px;padding:6px 12px;font-weight:700;font-size:13px;letter-spacing:0.3px;transition:0.15s;}",
    ".m-back-btn:hover{background:#00f5d4;color:#05070b;}",
    ".m-home-btn{cursor:pointer;background:#18181b;color:#f43f5e;border:1px solid #f43f5e;border-radius:6px;padding:6px 12px;font-weight:700;font-size:13px;text-decoration:none;transition:0.15s;}",
    ".m-home-btn:hover{background:#f43f5e;color:#fff;}",
    ".m-panel-back{cursor:pointer;display:inline-flex;align-items:center;gap:6px;margin:6px 0 10px 0;background:#0f172a;color:#38bdf8;border:1px solid #38bdf8;border-radius:6px;padding:5px 10px;font-family:monospace;font-size:12px;font-weight:700;}",
    ".m-panel-back:hover{background:#38bdf8;color:#05070b;}"
  ].join("");
  document.head.appendChild(style);

  function goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = "/index.html";
    }
  }

  var path = (window.location.pathname || "").toLowerCase();
  var isHome = path === "/" || path.endsWith("/index.html") || path === "";

  // 1. Gorna lenta za vrushtane na vsqka otdelna stranica / opciq
  if (!isHome) {
    var bar = document.createElement("div");
    bar.className = "m-back-bar";

    var backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "m-back-btn";
    backBtn.textContent = "← Назад";
    backBtn.onclick = goBack;

    var homeLink = document.createElement("a");
    homeLink.className = "m-home-btn";
    homeLink.href = "/index.html";
    homeLink.textContent = "⌂ Начало (MARAUDER-AI)";

    bar.appendChild(backBtn);
    bar.appendChild(homeLink);
    document.body.insertBefore(bar, document.body.firstChild);
  }

  // 2. Avtomatichno dobavqne na buton "← Назад / Затвори" vuv vutreshni paneli, dropdown-i i modali
  var panelHistory = [];
  function attachPanelBackButtons() {
    var candidates = document.querySelectorAll("[id*='modal'],[id*='panel'],[id*='menu'],[id*='drawer'],[id*='options'],[class*='modal'],[class*='panel'],[class*='dropdown']");
    candidates.forEach(function (el) {
      if (el.dataset.mBackAttached === "1") return;
      var st = window.getComputedStyle(el);
      if (st.display === "none" || st.visibility === "hidden") return;
      if (el.offsetHeight < 40 || el.offsetWidth < 120) return;

      el.dataset.mBackAttached = "1";
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "m-panel-back";
      btn.textContent = "← Назад";
      btn.onclick = function (e) {
        e.stopPropagation();
        el.style.display = "none";
        el.classList.remove("open", "active", "show");
      };
      el.insertBefore(btn, el.firstChild);
      panelHistory.push(el);
    });
  }

  document.addEventListener("click", function () {
    setTimeout(attachPanelBackButtons, 60);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      while (panelHistory.length) {
        var last = panelHistory.pop();
        if (last && window.getComputedStyle(last).display !== "none") {
          last.style.display = "none";
          last.classList.remove("open", "active", "show");
          return;
        }
      }
      if (!isHome) goBack();
    }
  });
})();
