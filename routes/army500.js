const express = require("express");
const Marauder500Army = require("../modules/marauder-500-army");

const router = express.Router();
const army = new Marauder500Army();

router.get("/agents", (req, res) => {
  res.json(army.listAgents(req.query));
});

router.post("/dispatch", async (req, res) => {
  try {
    const result = await army.dispatch(req.body || {});
    res.status(result.ok ? 200 : result.status === "APPROVAL_REQUIRED" ? 428 : 400).json(result);
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
});

module.exports = router;
