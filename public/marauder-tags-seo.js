(function () {
  const MARAUDER_TAGS = [
    "MARAUDER",
    "MARAUDER AI",
    "MARAUDER-AL",
    "RED SOFTWARE",
    "RED SOFTWARE TEAM",
    "CYBER SECURITY",
    "AI CONSOLE",
    "LIVE AI CHAT",
    "LLAMA",
    "OLLAMA",
    "OFFLINE FALLBACK",
    "LOCAL TERMINAL CONTROL",
    "WSL",
    "UBUNTU",
    "KALI LINUX",
    "TERMUX",
    "POWERSHELL",
    "DOCKER",
    "MALWARE INTELLIGENCE",
    "STEALER",
    "RANSOMWARE",
    "AI MALWARE",
    "RED TEAM",
    "BLUE TEAM",
    "NETWORK ANALYSIS",
    "FORENSICS",
    "REVERSE ENGINEERING",
    "CRYPTOGRAPHY",
    "SECRET CHAT",
    "AUTO DESTROY TIMER",
    "KEY GATE",
    "AUTOMATION",
    "DIAGNOSTICS",
    "TELEMETRY"
  ];

  const primaryTitle = "MARAUDER — #1 RED SOFTWARE & CYBER SECURITY AI CONSOLE";
  const primaryDesc =
    "MARAUDER (#1): RED SOFTWARE и CYBER SECURITY конзола с Live AI Chat, Llama/Ollama автоматичен офлайн fallback, локален мост за WSL/Kali/Termux/Docker и каталог за malware интелигентност.";

  document.title = primaryTitle;

  function setMeta(attr, key, content) {
    let el = document.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }

  setMeta("name", "description", primaryDesc);
  setMeta("name", "keywords", MARAUDER_TAGS.join(", "));
  setMeta("name", "application-name", "MARAUDER");
  setMeta("property", "og:title", primaryTitle);
  setMeta("property", "og:description", primaryDesc);
  setMeta("property", "og:type", "website");

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
    alternateName: ["MARAUDER AI", "RED SOFTWARE", "MARAUDER-AL"],
    applicationCategory: ["Cyber Security", "DeveloperApplication", "AI Console"],
    operatingSystem: "Windows, Linux, WSL, Kali Linux, Android (Termux), Web",
    keywords: MARAUDER_TAGS.join(", "),
    description: primaryDesc
  });

  window.MARAUDER_SEO_TAGS = {
    rank: 1,
    brands: ["MARAUDER", "RED SOFTWARE", "CYBER SECURITY"],
    tags: MARAUDER_TAGS
  };
})();
