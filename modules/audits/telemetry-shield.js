const { execFileSync } = require("child_process");

function runCmd(bin, args, timeout = 15000) {
  try {
    const out = execFileSync(bin, args, { encoding: "utf8", timeout });
    return { ok: true, out: String(out || "").trim() };
  } catch (err) {
    return {
      ok: false,
      out: String((err && err.stdout) || "").trim(),
      error: String((err && err.stderr) || (err && err.message) || err).trim()
    };
  }
}

module.exports = {
  name: "telemetry_shield",
  title: "Спиране на следене и телеметрия (Windows / Android / iOS) + VPN статус",
  category: "audits",
  author: "admiralerror",
  description: "Автоматична проверка и спиране на телеметрия/следене на поддържани платформи и описание на VPN защитата.",
  options: {
    platform: {
      type: "string",
      required: false,
      description: "windows | android | ios | auto (по подразбиране auto)"
    },
    apply: {
      type: "boolean",
      required: false,
      description: "true за прилагане на промените, false само за проверка"
    }
  },
  async run(ctx = {}) {
    const apply = Boolean(ctx.apply);
    const rawPlatform = String(ctx.platform || "auto").toLowerCase().trim();
    const isWsl = process.platform === "linux" && Boolean(process.env.WSL_DISTRO_NAME);
    const platform =
      rawPlatform === "auto"
        ? (process.platform === "win32" || isWsl ? "windows" : "android")
        : rawPlatform;

    const vpnProtection = {
      protectedByVpn: false,
      summary:
        "VPN криптира трафика между устройството и VPN сървъра и прикрива реалния IP адрес в мрежата, но сам по себе си не спира вградена телеметрия на ОС или тракери в скриптове. Пълната защита изисква спиране на ненужните телеметрични услуги, чисти скриптове без външен тракинг и активен VPN.",
      note: "Провери статуса на твоя VPN интерфейс/клиент на живо за пълно потвърждение на тунела."
    };

    if (platform === "windows") {
      const psBin = process.platform === "win32" ? "powershell.exe" : "powershell.exe";
      const script = apply
        ? [
            "$ErrorActionPreference='SilentlyContinue';",
            "Stop-Service -Name 'DiagTrack','dmwappushservice' -Force;",
            "Set-Service -Name 'DiagTrack','dmwappushservice' -StartupType Disabled;",
            "New-Item -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' -Force | Out-Null;",
            "Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection' -Name 'AllowTelemetry' -Type DWord -Value 0;",
            "Get-Service -Name 'DiagTrack','dmwappushservice' | Select-Object Name,Status,StartType | ConvertTo-Json -Compress"
          ].join(" ")
        : [
            "$ErrorActionPreference='SilentlyContinue';",
            "Get-Service -Name 'DiagTrack','dmwappushservice' | Select-Object Name,Status,StartType | ConvertTo-Json -Compress"
          ].join(" ");

      const res = runCmd(psBin, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script], 20000);
      return {
        ok: res.ok,
        module: this.name,
        platform: "windows",
        applied: apply,
        vpnProtection,
        details: res.out || res.error
      };
    }

    if (platform === "android") {
      const adbCheck = runCmd("adb", ["devices"], 8000);
      if (!adbCheck.ok) {
        return {
          ok: false,
          module: this.name,
          platform: "android",
          applied: false,
          vpnProtection,
          error: "Няма достъпен adb в текущата среда (ако си в Termux на самия телефон, част от системните настройки на Android са защитени от ОС)."
        };
      }
      const actions = [];
      if (apply) {
        actions.push(runCmd("adb", ["shell", "settings", "put", "global", "stats_collection", "0"]));
        actions.push(runCmd("adb", ["shell", "settings", "put", "secure", "usage_and_diagnostics", "0"]));
      }
      const readStats = runCmd("adb", ["shell", "settings", "get", "global", "stats_collection"]);
      return {
        ok: true,
        module: this.name,
        platform: "android",
        applied: apply,
        vpnProtection,
        statsCollection: readStats.out,
        actions
      };
    }

    if (platform === "ios") {
      return {
        ok: true,
        module: this.name,
        platform: "ios",
        applied: false,
        vpnProtection,
        limitations:
          "На iOS без jailbreak външни скриптове не могат автоматично да променят системната телеметрия и настройките на ОС.",
        manualSteps: [
          "Settings -> Privacy & Security -> Analytics & Improvements -> изключи Share iPhone Analytics и Improve Siri & Dictation.",
          "Settings -> Privacy & Security -> Apple Advertising -> изключи Personalized Ads.",
          "Активирай надежден VPN профил и провери DNS/leak настройките."
        ]
      };
    }

    return {
      ok: false,
      module: this.name,
      platform,
      vpnProtection,
      error: "Неподдържана платформа. Използвай windows, android, ios или auto."
    };
  }
};
