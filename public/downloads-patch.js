(function () {
  const REPO_URL = "https://github.com/gtupoto7-collab/MARAUDER-AI-RED.git";
  const CLONE_CMD = "git clone " + REPO_URL;

  window.MARAUDER_DOWNLOADS = {
    windows: "/downloads/MARAUDER-AI-Windows.zip",
    android: "/downloads/MARAUDER-AI-Android.apk",
    iosInfo: "/downloads/MARAUDER-AI-iOS-INFO.txt",
    repo: REPO_URL,
    cloneCmd: CLONE_CMD
  };

  window.copyMarauderCloneCmd = function (btnEl) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(CLONE_CMD).catch(() => {});
    }
    const tmp = document.createElement("textarea");
    tmp.value = CLONE_CMD;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand("copy");
    document.body.removeChild(tmp);
    if (btnEl) {
      const prev = btnEl.textContent;
      btnEl.textContent = "COPIED: git clone";
      setTimeout(() => { btnEl.textContent = prev; }, 1500);
    }
  };

  function mountDirectBar() {
    if (document.getElementById("marauder-direct-dl-bar")) return;
    const bar = document.createElement("div");
    bar.id = "marauder-direct-dl-bar";
    bar.style.cssText = "position:fixed;bottom:12px;right:12px;z-index:99999;background:#111;color:#fff;border:1px solid #ef4444;padding:10px 12px;border-radius:8px;font-family:monospace;font-size:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;";
    bar.innerHTML =
      '<a href="/downloads/MARAUDER-AI-Windows.zip" download style="color:#fff;background:#b91c1c;padding:5px 8px;border-radius:5px;text-decoration:none;">WIN .ZIP</a>' +
      '<a href="/downloads/MARAUDER-AI-Android.apk" download style="color:#fff;background:#b91c1c;padding:5px 8px;border-radius:5px;text-decoration:none;">ANDROID .APK</a>' +
      '<a href="/downloads/MARAUDER-AI-iOS-INFO.txt" download style="color:#fff;background:#374151;padding:5px 8px;border-radius:5px;text-decoration:none;">iOS INFO</a>' +
      '<button type="button" onclick="window.copyMarauderCloneCmd(this)" style="color:#fff;background:#1f2937;border:1px solid #ef4444;padding:5px 8px;border-radius:5px;cursor:pointer;">COPY git clone</button>';
    document.body.appendChild(bar);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountDirectBar);
  } else {
    mountDirectBar();
  }
})();
