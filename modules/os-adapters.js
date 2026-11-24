const os = require("os");
const { execFileSync } = require("child_process");

const ADAPTERS = ["wsl", "ubuntu", "kali", "powershell", "termux"];

function detectEnvironmentStatus(adapterName) {
  const name = String(adapterName || "").toLowerCase();
  if (!ADAPTERS.includes(name)) {
    return { ok: false, error: `Непознат адаптер '${adapterName}'. Разрешени: ${ADAPTERS.join(", ")}.` };
  }

  const wslDistro = String(process.env.WSL_DISTRO_NAME || "");
  const isWsl = Boolean(wslDistro || process.env.WSL_INTEROP);

  if (name === "wsl") {
    return { ok: true, adapter: "wsl", online: isWsl, mode: "controlled-bridge", detail: wslDistro || "WSL session" };
  }
  if (name === "ubuntu") {
    return { ok: true, adapter: "ubuntu", online: /ubuntu/i.test(wslDistro), mode: "non-root-adapter", detail: "Ubuntu environment profile" };
  }
  if (name === "kali") {
    return { ok: true, adapter: "kali", online: /kali/i.test(wslDistro), mode: "non-root-adapter", detail: "Kali lab profile (authorized scope only)" };
  }
  if (name === "powershell") {
    let psAvailable = false;
    try {
      execFileSync("which", ["pwsh"], { stdio: "ignore" });
      psAvailable = true;
    } catch {}
    return { ok: true, adapter: "powershell", online: os.platform() === "win32" || psAvailable, mode: "scoped-command-adapter", detail: "Windows / PowerShell bridge" };
  }
  return { ok: true, adapter: "termux", online: false, mode: "paired-mobile-adapter", detail: "Requires paired Termux endpoint on local/tailnet" };
}

function getAllAdaptersStatus() {
  return ADAPTERS.map((a) => detectEnvironmentStatus(a));
}

module.exports = { ADAPTERS, detectEnvironmentStatus, getAllAdaptersStatus };
