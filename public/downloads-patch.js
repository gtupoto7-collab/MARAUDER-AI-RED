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
})();
