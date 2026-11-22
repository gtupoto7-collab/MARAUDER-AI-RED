(function () {
  if (window.__marauderShieldLiveLoaded) return;
  window.__marauderShieldLiveLoaded = true;

  var box = document.createElement("div");
  box.id = "marauderBackendShieldBox";
  box.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:99998;background:#090b10;color:#e5e7eb;border:1px solid #38bdf8;border-radius:8px;padding:10px 12px;font-family:monospace;font-size:11px;line-height:1.45;max-width:320px;box-shadow:0 6px 20px rgba(0,0,0,0.6);";
  box.innerHTML = "<strong style=\"color:#facc15;\">TOR/VPN SHIELD</strong><br>State: <span>CHECKING</span>";

  function renderStatus(s) {
    var connected = Boolean(s && s.tunnel === "CONNECTED");
    var allowed = Boolean(s && s.application === "ALLOWED");
    var stateLabel = !s ? "CHECKING" : (connected ? "ACTIVE" : "OFFLINE");

    box.style.borderColor = connected && allowed ? "#22c55e" : "#ef4444";
    if (!connected) {
      box.innerHTML = [
        "<strong style=\"color:#f87171;\">TOR/VPN SHIELD (" + stateLabel + ")</strong>",
        "------------------------",
        "Tunnel:        <span style=\"color:#f87171;\">NOT DETECTED</span>",
        "External IP:   DIRECT CONNECTION",
        "DNS / Leak:    <span style=\"color:#f87171;\">UNVERIFIED / FAILED</span>",
        "Note:          No 100% anonymity guarantee",
        "<strong style=\"color:#f87171;\">NET MODE: " + (allowed ? "UNENFORCED" : "BLOCKED (503)") + "</strong>"
      ].join("<br>");
    } else {
      box.innerHTML = [
        "<strong style=\"color:#4ade80;\">TOR/VPN SHIELD (" + stateLabel + ")</strong>",
        "------------------------",
        "Tunnel:        <span style=\"color:#4ade80;\">CONNECTED</span> (" + (s.latencyMs || 0) + " ms)",
        "Endpoint:      " + (s.endpoint || "127.0.0.1:9050"),
        "External IP:   " + (s.externalIp || "VIA_TUNNEL_SOCKS5"),
        "DNS / Leak:    " + (s.dnsCheck || "PASS") + " / " + (s.leakCheck || "PASS"),
        "Application:   <strong style=\"color:#4ade80;\">" + (allowed ? "ALLOWED" : "BLOCKED") + "</strong>"
      ].join("<br>");
    }

    // Sync any visible VPN / IP check status blocks on the page without breaking existing text
    document.querySelectorAll("[data-vpn-shield-sync], #vpnShieldLiveOut, #shieldStatusBox").forEach(function (el) {
      el.setAttribute("data-shield-state", stateLabel);
      el.setAttribute("data-shield-tunnel", connected ? "CONNECTED" : "NOT DETECTED");
    });
  }

  async function pollShield() {
    if (!window.fetch) return;
    try {
      var r = await fetch("/api/shield/status", { cache: "no-store" });
      var data = await r.json();
      renderStatus(data);
    } catch (_) {
      renderStatus({ tunnel: "NOT DETECTED", application: "BLOCKED" });
    }
  }

  function bindVpnButtons() {
    document.querySelectorAll("button").forEach(function (btn) {
      if (btn.dataset.shieldBound) return;
      var label = (btn.textContent || "").toLowerCase();
      if (label.indexOf("vpn") !== -1 || label.indexOf("tor") !== -1 || label.indexOf("ip") !== -1 || label.indexOf("shield") !== -1) {
        btn.dataset.shieldBound = "1";
        btn.addEventListener("click", function () {
          setTimeout(pollShield, 150);
        });
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.body.appendChild(box);
    bindVpnButtons();
    pollShield();
    setInterval(pollShield, 5000);
  });
})();
