(function () {
  const MAP = {
    win: "/downloads/MARAUDER-AI-Windows.zip",
    windows: "/downloads/MARAUDER-AI-Windows.zip",
    android: "/downloads/MARAUDER-AI-Android.apk",
    apk: "/downloads/MARAUDER-AI-Android.apk",
    ios: "/downloads/MARAUDER-AI-iOS-INFO.txt"
  };

  async function triggerFileDownload(url, filename) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename || url.split("/").pop() || "download.bin";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
    } catch {
      const a = document.createElement("a");
      a.href = url;
      a.setAttribute("download", filename || url.split("/").pop() || "download.bin");
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  function detectTarget(el) {
    const txt = ((el.textContent || "") + " " + (el.getAttribute("href") || "") + " " + (el.dataset.download || "") + " " + (el.id || "")).toLowerCase();
    if (txt.includes("windows") || txt.includes("win") || txt.includes(".exe") || txt.includes(".zip")) {
      return { url: MAP.win, name: "MARAUDER-AI-Windows.zip" };
    }
    if (txt.includes("android") || txt.includes(".apk")) {
      return { url: MAP.android, name: "MARAUDER-AI-Android.apk" };
    }
    if (txt.includes("ios") || txt.includes("iphone")) {
      return { url: MAP.ios, name: "MARAUDER-AI-iOS-INFO.txt" };
    }
    return null;
  }

  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("a, button, [role='button'], [data-download]");
    if (!el) return;
    const info = detectTarget(el);
    if (!info) return;
    ev.preventDefault();
    ev.stopPropagation();
    triggerFileDownload(info.url, info.name);
  }, true);
})();
