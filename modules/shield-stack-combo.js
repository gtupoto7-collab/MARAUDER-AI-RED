"use strict";

const { isFeatureEnabled } = require("./feature-flags-registry");
const { checkProtectedChannel } = require("./protected-route-gate");

async function evaluateShieldStack(opts = {}) {
const platform = String(opts.platform || process.env.MARAUDER_TARGET_PLATFORM || "windows").toLowerCase();
const isIos = platform === "ios";
const networkEnabled = isFeatureEnabled("network", "connectionCheck");
const torFlagEnabled = isFeatureEnabled("network", "torStatus");
const vpnFlagEnabled = isFeatureEnabled("network", "vpnStatus");
const gate = await checkProtectedChannel({
host: opts.host || process.env.TOR_HOST || "127.0.0.1",
port: Number(opts.port || process.env.TOR_SOCKS_PORT || 9050),
required: Boolean(opts.required)
});

const stack = isIos
? ["iOS VPN", "Orbot/Tor Proxy", "MARAUDER-AI"]
: ["Windscribe", "Orbot/Tor", "MARAUDER-AI"];

return {
platform,
isIos,
stack,
iosNotes: isIos
  ? [
      "On iOS, enable VPN + On-Demand/Kill-Switch-like protection in iOS VPN settings.",
      "If using Orbot/proxy on iOS, verify SOCKS5/proxy reachability rather than assuming OS-wide process visibility.",
      "Keep fail-closed mode enabled for protected API endpoints when strict gating is required."
    ]
  : [],
flags: {
  connectionCheck: networkEnabled,
  torStatus: torFlagEnabled,
  vpnStatus: vpnFlagEnabled
},
orbotTorSocks5: gate.probe,
gateMode: gate.mode,
allowed: gate.allowed,
disclaimer: "Verified tunnel state only; no 100% anonymity guarantee."
};
}

module.exports = { evaluateShieldStack };
