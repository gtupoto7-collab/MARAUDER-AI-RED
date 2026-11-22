"use strict";

const net = require("net");

function probeSocks5(host = "127.0.0.1", port = 9050, timeoutMs = 2500) {
  return new Promise((resolve) => {
    const started = Date.now();
    const sock = new net.Socket();
    let done = false;

    const finish = (active, state, detail) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve({
        state, // "CHECKING" | "ACTIVE" | "OFFLINE"
        active,
        endpoint: `${host}:${port}`,
        latencyMs: Date.now() - started,
        detail
      });
    };

    sock.setTimeout(timeoutMs);
    sock.once("error", (err) => finish(false, "OFFLINE", err.code || err.message));
    sock.once("timeout", () => finish(false, "OFFLINE", "SOCKS5_TIMEOUT"));
    sock.connect(port, host, () => {
      sock.write(Buffer.from([0x05, 0x01, 0x00]));
    });
    sock.once("data", (buf) => {
      if (buf && buf.length >= 2 && buf[0] === 0x05 && buf[1] !== 0xff) {
        finish(true, "ACTIVE", "SOCKS5_HANDSHAKE_OK");
      } else {
        finish(false, "OFFLINE", "INVALID_SOCKS5_REPLY");
      }
    });
  });
}

module.exports = { probeSocks5 };
