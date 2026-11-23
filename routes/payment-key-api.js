const express = require("express");
const keyGate = require("../modules/key-gate-engine");

const router = express.Router();

router.post("/pay/issue-key", (req, res) => {
  try {
    const body = req.body || {};
    const ref = body.paymentRef || body.txId || body.orderId || `AUTO-${Date.now()}`;
    const tier = body.tier || "MARAUDER-FULL-TOR-APP";
    const record = keyGate.issueKeyOnPayment(ref, tier);
    res.json({
      ok: true,
      key: record.key,
      tier: record.tier,
      paymentRef: record.paymentRef,
      createdAt: record.createdAt
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/pay/verify-key", (req, res) => {
  const key = (req.body && (req.body.key || req.body.code)) || "";
  const result = keyGate.verifyUnlockKey(key);
  res.json({ ok: true, ...result });
});

module.exports = router;
