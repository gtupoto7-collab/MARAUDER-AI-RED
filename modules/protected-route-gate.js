"use strict";

const { probeSocks5 } = require("./tor-socks5-verifier");

async function checkProtectedChannel(options = {}) {
  const host = options.host || "127.0.0.1";
  const port = Number(options.port || 9050);
  const required = Boolean(options.required);

  const probe = await probeSocks5(host, port, options.timeoutMs || 2500);
  if (!required) {
    return {
      allowed: true,
      mode: probe.active ? "TOR_SOCKS5_ACTIVE" : "UNENFORCED",
      probe
    };
  }

  return {
    allowed: probe.active,
    mode: probe.active ? "PROTECTED_SOCKS5_READY" : "BLOCKED_NO_VERIFIED_PROXY",
    probe
  };
}

module.exports = { checkProtectedChannel };
