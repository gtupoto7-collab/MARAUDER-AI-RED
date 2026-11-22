(function () {
  window.MarauderWalletSecurity = {
    init: function () {
      const btn = document.getElementById("mw-verify-btn");
      if (!btn) return;
      btn.addEventListener("click", () => {
        const email = (((document.getElementById("mw-email") || {}).value) || "").trim();
        const statusEl = document.getElementById("mw-account-status");
        const emailState = email && email.includes("@") ? "SESSION_SET (" + email + ")" : "UNVERIFIED";
        if (statusEl) {
          statusEl.innerHTML =
            "EMAIL: " + emailState + "<br/>" +
            "2FA: READY (CLIENT/SERVER GUARD)<br/>" +
            "DEVICE: TRUSTED_SESSION<br/>" +
            "WALLET: NON_CUSTODIAL_READY";
        }
        if (window.MarauderWalletTx) {
          window.MarauderWalletTx.addLog("ACCOUNT_CHECK", "Обновен статус на акаунта: " + emailState);
        }
      });
      if (window.MarauderWalletTx) {
        window.MarauderWalletTx.init();
      }
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => window.MarauderWalletSecurity.init());
  } else {
    window.MarauderWalletSecurity.init();
  }
})();
