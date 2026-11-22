"use strict";

const PAYPAL_NCP_URL = process.env.PAYPAL_NCP_URL || "https://www.paypal.com/ncp/payment/RPTDVVN5XA4XC";

function getPayPalPublicConfig() {
  return {
    ok: true,
    provider: "paypal-ncp",
    accountLabel: "daniel danailov",
    product: "MARAUDER-AI",
    currency: "EUR",
    minAmountEur: 5,
    maxAmountEur: 15000,
    paymentUrl: PAYPAL_NCP_URL,
    serverCredentialsConfigured: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET)
  };
}

module.exports = { getPayPalPublicConfig };
