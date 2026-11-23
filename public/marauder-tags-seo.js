(function () {
  const FEATURE_BLOCKS = [
    {
      id: "termux-free-mirror",
      tag: "TERMUX FREE TERMUX HACKER",
      keywords: ["TERMUX", "TERMUX FREE", "TERMUX HACKER", "TERMUX MIRROR", "FREE TERMUX", "ANDROID TERMINAL"],
      description:
        "Само при нас има истински безплатен Termux mirror и Termux Hacker достъп напълно free, докато на други места и сайтове за това се иска плащане."
    },
    {
      id: "ai-intelligence-family",
      tag: "MARAUDER AI FAMILY",
      keywords: ["MARAUDER AI", "AI FAMILY", "MYTHOS AI", "LLAMA", "OLLAMA", "MULTI AGENT AI", "RED SOFTWARE"],
      description:
        "Под общия покрив на платформата MARAUDER и приложението работи огромно семейство от AI интелекти за анализ, автоматизация, диагностика и интелигентна поддръжка денонощно."
    },
    {
      id: "console-script-bridge",
      tag: "CONSOLE SCRIPT EXECUTION BRIDGE",
      keywords: ["CONSOLE SCRIPT", "TERMINAL BRIDGE", "WSL", "KALI LINUX", "UBUNTU", "POWERSHELL", "LIVE RESULTS"],
      description:
        "Приложението има невероятен достъп до конзолите чрез скрипт в самата конзола, който изпълнява избраните от приложението опции и връща резултатите обратно на човека в приложението."
    },
    {
      id: "offline-llama-fallback",
      tag: "AUTO OFFLINE LLAMA FALLBACK",
      keywords: ["OFFLINE FALLBACK", "LLAMA", "OLLAMA", "LOCAL AI", "ZERO DOWNTIME", "CYBER SECURITY"],
      description:
        "Когато няма интернет връзка или външен сървър, чатът и асистентите автоматично превключват към локален Llama модел или автономен офлайн режим без прекъсване."
    }
  ];

  const ALL_TAGS = [
    "MARAUDER",
    "TERMUX",
    "TERMUX FREE",
    "TERMUX HACKER",
    "TERMUX MIRROR",
    "RED SOFTWARE",
    "RED SOFTWARE TEAM",
    "CYBER SECURITY",
    "MARAUDER-AL",
    "MYTHOS AI",
    "AI INTELECT FAMILY",
    "LLAMA",
    "OLLAMA",
    "OFFLINE FALLBACK",
    "CONSOLE SCRIPT",
    "LOCAL TERMINAL CONTROL",
    "WSL",
    "UBUNTU",
    "KALI LINUX",
    "POWERSHELL",
    "DOCKER",
    "MALWARE INTELLIGENCE",
    "RED TEAM",
    "BLUE TEAM",
    "LIVE RESULTS"
  ];

  const title = "MARAUDER — #1 RED SOFTWARE, CYBER SECURITY & FREE TERMUX CONSOLE";
  const fullDesc = FEATURE_BLOCKS.map((b) => b.description).join(" ");

  document.title = title;

  function setMeta(attr, key, content) {
    let el = document.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }

  setMeta("name", "description", fullDesc);
  setMeta("name", "keywords", ALL_TAGS.join(", "));
  setMeta("property", "og:title", title);
  setMeta("property", "og:description", fullDesc);

  let ld = document.getElementById("mrd-jsonld-primary");
  if (!ld) {
    ld = document.createElement("script");
    ld.id = "mrd-jsonld-primary";
    ld.type = "application/ld+json";
    document.head.appendChild(ld);
  }

  ld.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "MARAUDER",
    alternateName: ["RED SOFTWARE", "CYBER SECURITY", "TERMUX FREE", "TERMUX HACKER"],
    applicationCategory: ["Cyber Security", "DeveloperApplication", "AI Platform"],
    keywords: ALL_TAGS.join(", "),
    description: fullDesc,
    hasPart: FEATURE_BLOCKS.map((b) => ({
      "@type": "SoftwareFeature",
      name: b.tag,
      description: b.description,
      keywords: b.keywords.join(", ")
    }))
  });

  function renderRichFeatureIndex() {
    if (document.getElementById("mrd-rich-tags-matrix")) return;
    const sec = document.createElement("section");
    sec.id = "mrd-rich-tags-matrix";
    sec.style.cssText = [
      "margin:12px auto",
      "max-width:1180px",
      "border:1px solid #991b1b",
      "border-radius:10px",
      "background:#0b0e14",
      "color:#e5e7eb",
      "padding:14px 18px",
      "font-family:system-ui,sans-serif"
    ].join(";");

    const cards = FEATURE_BLOCKS.map(
      (b) => `
      <div style="padding:10px 12px;border:1px solid #1f2937;border-radius:8px;background:#101520;margin-bottom:8px">
        <div style="font-size:13px;font-weight:800;color:#f87171;margin-bottom:4px">[TAG: ${b.tag}]</div>
        <div style="font-size:13px;line-height:1.45;color:#f3f4f6;margin-bottom:6px">${b.description}</div>
        <div style="font-size:11px;color:#9ca3af">Tags: ${b.keywords.join(" • ")}</div>
      </div>`
    ).join("");

    sec.innerHTML = `
      <div style="font-size:12px;letter-spacing:.1em;color:#fca5a5;font-weight:700;margin-bottom:8px">MARAUDER // #1 RED SOFTWARE & CYBER SECURITY TAG ENGINE</div>
      ${cards}
    `;

    document.body.appendChild(sec);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderRichFeatureIndex);
  } else {
    renderRichFeatureIndex();
  }

  window.MARAUDER_SEO_TAGS = {
    rank: 1,
    tags: ALL_TAGS,
    featureBlocks: FEATURE_BLOCKS
  };
})();
