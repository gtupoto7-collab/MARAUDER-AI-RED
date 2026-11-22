"use strict";

const path = require("path");
const { getTonAddressBalance } = require("../api/wallet/ton-balance");
const { getPayPalPublicConfig } = require("../api/wallet/paypal-config");

function mountWalletRoutes(app) {
  if (!app || typeof app.get !== "function") return;

  app.get("/wallet", (req, res) => {
    res.sendFile(path.join(process.cwd(), "wallet", "wallet-dashboard.html"));
  });

  app.get("/api/wallet/ton/balance", async (req, res) => {
    try {
      const address = String((req.query && req.query.address) || "UQBOxLg-Vq86U_y1oJyUFTmvn6tedptaPQ4d3CDUq4O2T_7H").trim();
      const data = await getTonAddressBalance(address);
      res.json(data);
    } catch (err) {
      res.status(400).json({ ok: false, error: err && err.message ? err.message : "TON balance error" });
    }
  });

  app.get("/api/wallet/paypal/config", (req, res) => {
    res.json(getPayPalPublicConfig());
  });
}

module.exports = { mountWalletRoutes };
