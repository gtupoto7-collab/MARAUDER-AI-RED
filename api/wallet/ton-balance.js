"use strict";

async function getTonAddressBalance(address) {
  const clean = String(address || "").trim();
  if (!clean) {
    throw new Error("Missing TON address");
  }
  const url = "https://toncenter.com/api/v2/getAddressInformation?address=" + encodeURIComponent(clean);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("TON RPC request failed with status " + res.status);
  }
  const data = await res.json();
  const rawNano = (data && data.result && data.result.balance) || "0";
  const balanceTon = Number(rawNano) / 1e9;
  return {
    ok: true,
    address: clean,
    balanceNano: String(rawNano),
    balanceTon: Number.isFinite(balanceTon) ? balanceTon : 0,
    source: "toncenter-v2"
  };
}

module.exports = { getTonAddressBalance };
