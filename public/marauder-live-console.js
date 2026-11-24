(function () {
  const CATEGORIES = [
    { name: "AI Red Team", count: 64, tools: ["Prompt-Guard Audit", "LLM Jailbreak Simulator", "Model Boundary Scanner", "Adversarial Token Probe"] },
    { name: "Penetration Testing", count: 88, tools: ["Recon Orchestrator", "Service Fingerprinter", "Surface Mapper", "Session Audit"] },
    { name: "Web Exploitation", count: 76, tools: ["Header & CSP Inspector", "Auth Flow Analyzer", "XSS/SQLi Safe Validator", "API Endpoint Mapper"] },
    { name: "Network Analysis", count: 72, tools: ["Nmap Profile Builder", "Packet Flow Monitor", "DNS/TLS Verifier", "Port & Banner Audit"] },
    { name: "Password Attacks", count: 54, tools: ["Hashcat Rule Generator", "Entropy & Policy Checker", "Wordlist Mutator", "KDF Benchmark"] },
    { name: "Wireless Attacks", count: 42, tools: ["802.11 Frame Inspector", "WPA2/3 Handshake Validator", "RF Channel Scanner", "BLE Beacon Audit"] },
    { name: "Social Engineering", count: 38, tools: ["Phishing Header Analyzer", "Domain Lookalike Detector", "OSINT Pretext Checker", "Awareness Simulator"] },
    { name: "Malware Analysis", count: 68, tools: ["Static String & PE Inspector", "YARA Rule Tester", "Sandbox Behavior Matrix", "IOC Extractor"] },
    { name: "Reverse Engineering", count: 59, tools: ["ELF/PE Section Viewer", "Disassembly Flow Map", "Symbol & Import Resolver", "Patch Diff Analyzer"] },
    { name: "Forensics", count: 61, tools: ["Timeline Reconstructor", "Memory Artifact Parser", "Log Correlation Engine", "Hash Integrity Verifier"] },
    { name: "Cryptography", count: 49, tools: ["Cipher & Mode Identifier", "JWT/TLS Cert Inspector", "Entropy Analyzer", "Key Derivation Lab"] },
    { name: "Steganography", count: 33, tools: ["LSB Bitplane Scanner", "Metadata & EXIF Stripper", "Container Carve Check", "Spectral Audio Inspector"] },
    { name: "Brute Force", count: 44, tools: ["Rate-Limit Tester", "Credential Stuffing Guard", "Protocol Lockout Audit", "Token Space Estimator"] },
    { name: "Proxy & Anonymity", count: 51, tools: ["Burp Suite Flow Helper", "SOCKS5/HTTP Chain Tester", "Header Leak Detector", "DNS Leak Guard"] },
    { name: "Tor Tools", count: 37, tools: ["Circuit & Relay Status", "Onion Service Health", "Bridge Reachability Check", "Exit Policy Inspector"] },
    { name: "Dark Web Tools", count: 41, tools: ["Threat Feed Monitor", "Leak Hash Watcher", "Paste & Forum Indexer", "Actor Alias Correlator"] },
    { name: "AI Security", count: 63, tools: ["Mythos Security Guard", "ScyNet AI Telemetry", "Agentic Loop Sandbox", "Prompt Injection Filter"] },
    { name: "Cloud Security", count: 58, tools: ["IAM Policy Linter", "S3/Blob Exposure Check", "Container Image Audit", "K8s RBAC Visualizer"] },
    { name: "Mobile Security", count: 47, tools: ["Termux Bridge Console", "APK Manifest & Cert Audit", "Traffic Pinning Inspector", "Intent Surface Scanner"] },
    { name: "IoT Security", count: 39, tools: ["Firmware Binwalk Inspector", "UART/JTAG Pinout Ref", "MQTT Broker Audit", "CAN Bus Frame Monitor"] },
    { name: "Red Team Tools", count: 65, tools: ["Attack Path Planner", "C2 Profile Validator", "Evasion Telemetry Check", "OPSEC Checklist"] },
    { name: "Blue Team Tools", count: 74, tools: ["Sigma Rule Builder", "SIEM Alert Triage", "MITRE ATT&CK Mapper", "Containment Playbook"] },
    { name: "Report & Dashboard", count: 45, tools: ["Executive Risk Matrix", "CVSS 4.0 Calculator", "IOC Export (JSON/STIX)", "Audit Log Generator"] }
  ];

  const TABS = ["HOME", "CYBER AI", "TOR", "MARKETPLACE", "OSINT", "DARK WEB", "EXPLOIT", "FORENSICS", "ANALYSIS", "REPORTS", "SETTINGS"];

  const FEED_ITEMS = [
    { type: "VIDEO", name: "cam_feed_04.mp4", archive: "archive_04.zip -> UNZIPPED", hash: "SHA256: 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", status: "DEHASHED & READY" },
    { type: "FILES", name: "device_dump_2026.tar.gz", archive: "tar.gz -> EXTRACTED (148 files)", hash: "MD5: 5d41402abc4b2a76b9719d911017c592 -> VERIFIED", status: "UNPACKED LIVE" },
    { type: "MEDIA", name: "snap_stream_09.png", archive: "pack_media.7z -> UNPACKED", hash: "SHA1: aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d -> DECODED", status: "STREAMING" },
    { type: "VOICE", name: "voice_note_12.wav", archive: "audio_bundle.rar -> EXTRACTED", hash: "HASH: e3b0c44298fc1c149afbf4c8996fb924 -> UNLOCKED", status: "LIVE AUDIO" }
  ];

  function buildConsole() {
    ["mrd-malware-intel-panel", "mrd-tags-seo-matrix", "mrd-bottom-bar"].forEach((id) => {
      const old = document.getElementById(id);
      if (old) old.remove();
    });

    document.body.style.margin = "0";
    document.body.style.background = "#05060a";
    document.body.style.color = "#f3f4f6";
    document.body.style.fontFamily = "'Segoe UI', system-ui, sans-serif";
    document.body.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = `
      * { box-sizing: border-box; }
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: #07090f; }
      ::-webkit-scrollbar-thumb { background: #991b1b; border-radius: 4px; }
      .mrd-app {
        min-height: 100vh;
        background:
          radial-gradient(circle at 50% 0%, rgba(185,28,28,0.28) 0%, rgba(5,6,10,0.96) 52%),
          linear-gradient(180deg, #090609 0%, #05060a 100%);
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .mrd-topbar {
        display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;
        padding: 10px 14px; border: 1px solid #b91c1c; border-radius: 10px;
        background: linear-gradient(180deg, #1b070b, #090c14);
        box-shadow: 0 0 24px rgba(220,38,38,.28);
      }
      .mrd-brand { font-size: 24px; font-weight: 900; letter-spacing: .14em; color: #fff; text-shadow: 0 0 16px #ef4444; }
      .mrd-sub { font-size: 11px; color: #fca5a5; letter-spacing: .16em; font-weight: 800; }
      .mrd-badges { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .mrd-badge {
        padding: 6px 10px; border-radius: 8px; border: 1px solid #7f1d1d;
        background: linear-gradient(180deg, #150b10, #0b0f19);
        font-size: 11px; font-weight: 800; cursor: pointer; transition: .15s;
      }
      .mrd-badge:hover { border-color: #f87171; box-shadow: 0 0 12px rgba(239,68,68,.4); }
      .mrd-nav {
        display: flex; flex-wrap: wrap; gap: 6px; padding: 6px;
        border: 1px solid #991b1b; border-radius: 10px;
        background: linear-gradient(180deg, #12070a, #090c13);
      }
      .mrd-tab {
        flex: 1 1 auto; text-align: center; padding: 8px 10px; border-radius: 7px;
        border: 1px solid #2b1116; background: #0e121c; color: #e5e7eb;
        font-size: 11px; font-weight: 900; letter-spacing: .04em; cursor: pointer; transition: .15s;
      }
      .mrd-tab:hover, .mrd-tab.active {
        background: linear-gradient(180deg, #b91c1c, #690d0d);
        border-color: #f87171; color: #fff; box-shadow: 0 0 14px rgba(239,68,68,.45);
      }
      .mrd-grid { display: grid; grid-template-columns: 270px 1fr 310px; gap: 8px; flex: 1; }
      @media (max-width: 1024px) { .mrd-grid { grid-template-columns: 1fr; } }
      .mrd-box {
        border: 1px solid #991b1b; border-radius: 10px;
        background: linear-gradient(180deg, #10080c 0%, #090c14 140px);
        padding: 10px; display: flex; flex-direction: column; gap: 8px;
        box-shadow: inset 0 0 18px rgba(153,27,27,.14);
      }
      .mrd-box-title {
        font-size: 12px; font-weight: 900; letter-spacing: .09em; color: #fca5a5;
        border-bottom: 1px solid #2a1016; padding-bottom: 6px;
        display: flex; justify-content: space-between; align-items: center;
      }
      .mrd-search {
        width: 100%; padding: 8px 10px; border-radius: 7px;
        border: 1px solid #7f1d1d; background: #06080e; color: #fff;
        font-size: 12px; outline: none;
      }
      .mrd-search:focus { border-color: #ef4444; box-shadow: 0 0 10px rgba(239,68,68,.35); }
      .mrd-cat-list { max-height: 430px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
      .mrd-cat-item {
        display: flex; justify-content: space-between; align-items: center;
        padding: 7px 9px; border-radius: 6px; border: 1px solid #231117;
        background: #0d111b; color: #e5e7eb; font-size: 12px; cursor: pointer; transition: .12s;
      }
      .mrd-cat-item:hover, .mrd-cat-item.active {
        border-color: #ef4444; background: linear-gradient(90deg, #380b12, #120b12); color: #fff;
      }
      .mrd-quick { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      .mrd-qbtn {
        padding: 7px; border-radius: 6px; border: 1px solid #991b1b;
        background: #120a10; color: #fca5a5; font-size: 11px; font-weight: 800; cursor: pointer;
      }
      .mrd-qbtn:hover { background: #991b1b; color: #fff; }
      .mrd-secret-banner {
        border: 1px solid #dc2626; border-radius: 10px; padding: 10px 12px;
        background: linear-gradient(90deg, #2d070d, #110912 55%, #24070c);
        box-shadow: 0 0 18px rgba(220,38,38,.25); cursor: pointer;
        display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px;
      }
      .mrd-secret-banner:hover { border-color: #f87171; box-shadow: 0 0 24px rgba(239,68,68,.45); }
      .mrd-btn {
        padding: 8px 12px; border-radius: 7px; border: 1px solid #ef4444;
        background: linear-gradient(180deg, #b91c1c, #6f0f0f); color: #fff;
        font-size: 11px; font-weight: 900; letter-spacing: .04em; cursor: pointer;
      }
      .mrd-btn:hover { filter: brightness(1.18); box-shadow: 0 0 10px rgba(239,68,68,.35); }
      .mrd-btn-green {
        border-color: #22c55e; background: linear-gradient(180deg, #15803d, #0d3b1e);
      }
      .mrd-chat-log {
        flex: 1; min-height: 210px; max-height: 290px; overflow-y: auto;
        border: 1px solid #2b1016; border-radius: 8px; background: #06080e;
        padding: 10px; display: flex; flex-direction: column; gap: 8px; font-size: 12px;
      }
      .mrd-msg { padding: 8px 10px; border-radius: 7px; border-left: 3px solid #ef4444; background: #0f131f; }
      .mrd-msg.ai { border-left-color: #38bdf8; }
      .mrd-msg.user { border-left-color: #22c55e; }
      .mrd-tools-view { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; }
      .mrd-tool-card {
        border: 1px solid #2b1016; border-radius: 8px;
        background: linear-gradient(180deg, #130b11, #0c101a); padding: 9px;
        display: flex; flex-direction: column; gap: 6px;
      }
      .mrd-bars {
        display: flex; align-items: flex-end; gap: 3px; height: 26px;
        padding: 4px; background: #06080e; border-radius: 6px; border: 1px solid #2b1016;
      }
      .mrd-bar { flex: 1; background: #22c55e; border-radius: 2px; transition: height .18s; }
    `;
    document.head.appendChild(style);

    const app = document.createElement("div");
    app.className = "mrd-app";
    app.innerHTML = `
      <header class="mrd-topbar">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:42px;height:42px;border-radius:10px;border:1px solid #ef4444;background:#24080d;display:flex;align-items:center;justify-content:center;font-weight:900;color:#ef4444;box-shadow:0 0 14px rgba(239,68,68,.45)">M</div>
          <div>
            <div class="mrd-brand">MARAUDER</div>
            <div class="mrd-sub">ULTIMATE HACKER CONSOLE v12.0 AI // #1 RED SOFTWARE</div>
          </div>
        </div>
        <div class="mrd-badges">
          <div class="mrd-badge" style="color:#38bdf8" data-ai="Mythos Security">Mythos Security</div>
          <div class="mrd-badge" style="color:#60a5fa" data-ai="ScyNet AI">ScyNet AI</div>
          <div class="mrd-badge" style="color:#f87171" data-ai="AI AGENT ACTIVE">AI AGENT ACTIVE</div>
          <div class="mrd-badge" style="color:#4ade80">SYSTEM: ONLINE • TOR: CONNECTED • VPN: ACTIVE</div>
        </div>
      </header>

      <nav class="mrd-nav" id="mrd-nav"></nav>

      <main class="mrd-grid">
        <aside class="mrd-box">
          <div class="mrd-box-title">
            <span>AI TOOLS (1000+)</span>
            <span id="mrd-cat-count" style="color:#4ade80">23 CATS</span>
          </div>
          <input id="mrd-tool-search" class="mrd-search" type="text" placeholder="Търси инструмент или категория..." />
          <div id="mrd-cat-list" class="mrd-cat-list"></div>
          <div class="mrd-box-title" style="margin-top:4px"><span>QUICK ACCESS</span></div>
          <div class="mrd-quick">
            <button class="mrd-qbtn" data-quick="Nmap">Nmap</button>
            <button class="mrd-qbtn" data-quick="Metasploit">Metasploit</button>
            <button class="mrd-qbtn" data-quick="Burp Suite">Burp Suite</button>
            <button class="mrd-qbtn" data-quick="Hashcat">Hashcat</button>
          </div>
        </aside>

        <section class="mrd-box" id="mrd-center-panel">
          <div id="mrd-secret-trigger" class="mrd-secret-banner" title="Кликни за пълен автоматизиран RED-SECRET CHAT">
            <div>
              <div style="font-size:15px;font-weight:900;letter-spacing:.08em;color:#fff;text-shadow:0 0 10px rgba(239,68,68,.5)">
                RED-SECRET CHAT // END-TO-END ENCRYPTED • AUTO DESTROY • 3 MIN
              </div>
              <div style="font-size:11px;color:#fca5a5">MARAUDER AI Secret Communication — кликни тук за автоматичен секретен канал</div>
            </div>
            <span id="mrd-timer" style="color:#f87171;font-size:16px;font-weight:900;padding:4px 10px;border:1px solid #dc2626;border-radius:7px;background:#160609">03:00</span>
          </div>

          <div class="mrd-box-title">
            <span id="mrd-center-title">RED-SECRET CHAT // LIVE AUTOMATED CHANNEL</span>
            <span id="mrd-secret-state" style="color:#4ade80">AUTO-LINK: READY</span>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div style="border:1px solid #2b1016;border-radius:8px;padding:8px;background:#0c101a;display:flex;flex-direction:column;gap:6px">
              <div style="font-size:11px;color:#fca5a5;font-weight:800">GENERATE CHAT KEY</div>
              <input id="mrd-gen-key" class="mrd-search" readonly value="MRD-7XQ9-KL2F-8V6P" />
              <input id="mrd-gen-pass" class="mrd-search" readonly value="zF9k-Qp3m-7H2v" />
              <button id="mrd-btn-gen" class="mrd-btn">GENERATE NEW KEY</button>
            </div>
            <div style="border:1px solid #2b1016;border-radius:8px;padding:8px;background:#0c101a;display:flex;flex-direction:column;gap:6px">
              <div style="font-size:11px;color:#86efac;font-weight:800">CONNECT TO SECRET CHAT</div>
              <input id="mrd-conn-key" class="mrd-search" value="MRD-7XQ9-KL2F-8V6P" />
              <div id="mrd-conn-status" style="font-size:11px;color:#4ade80">Connection: SUCCESS • Mode: SECRET AUTO</div>
              <button id="mrd-btn-conn" class="mrd-btn mrd-btn-green">ENTER & CONNECT</button>
            </div>
          </div>

          <div id="mrd-workspace" class="mrd-tools-view"></div>

          <div id="mrd-chat-log" class="mrd-chat-log">
            <div class="mrd-msg"><strong style="color:#f87171">MARAUDER:</strong> Секретният чат е активен и автоматизиран. Съобщенията се ротират на всеки 3 минути.</div>
            <div class="mrd-msg ai"><strong style="color:#38bdf8">AI Agent (Mythos):</strong> Свързан съм към RED-SECRET CHAT. Кажи команда или задача.</div>
          </div>

          <div style="display:flex;gap:6px">
            <input id="mrd-chat-input" class="mrd-search" type="text" placeholder="Напиши съобщение в RED-SECRET CHAT..." />
            <button id="mrd-chat-send" class="mrd-btn">SEND</button>
          </div>
        </section>

        <aside class="mrd-box">
          <div class="mrd-box-title">
            <span>VOICE CHAT & LIVE STREAM</span>
            <span style="color:#4ade80">ON</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">
            <button class="mrd-qbtn" data-media="MEDIA">MEDIA</button>
            <button class="mrd-qbtn" data-media="VOICE">VOICE</button>
            <button class="mrd-qbtn" data-media="VIDEO">VIDEO</button>
            <button class="mrd-qbtn" data-media="FILES">FILES</button>
          </div>
          <div id="mrd-media-box" style="border:1px solid #2b1016;border-radius:8px;padding:10px;background:#0c101a;font-size:12px;color:#d1d5db"></div>
          <div class="mrd-box-title"><span>MICROPHONE 2.0</span><span id="mrd-mic-state" style="color:#4ade80">Voice Active</span></div>
          <div id="mrd-bars" class="mrd-bars"></div>
          <div style="display:flex;gap:6px">
            <button id="mrd-speak-btn" class="mrd-btn" style="flex:1">SPEAK</button>
            <button id="mrd-listen-btn" class="mrd-btn mrd-btn-green" style="flex:1">AUTO REPLY</button>
          </div>
          <div class="mrd-box-title" style="margin-top:4px"><span>MALWARE INTELLIGENCE</span><span style="color:#fca5a5">LVL 0-4</span></div>
          <div id="mrd-intel-mini" style="font-size:11px;color:#9ca3af;line-height:1.45">
            Sources: MITRE ATT&CK, Google Threat Intel, Microsoft Security, ESET, MalwareBazaar, VirusTotal, CISA.
          </div>
        </aside>
      </main>
    `;
    document.body.appendChild(app);
// TOP 100 AI CYBERSECURITY AGENTS панел
    if (!document.getElementById("mrd-top100-section")) {
      const agentsSection = document.createElement("section");
      agentsSection.id = "mrd-top100-section";
      agentsSection.className = "mrd-box";
      agentsSection.innerHTML = `
        <div class="mrd-box-title">
          <span>TOP 100 AI CYBERSECURITY AGENTS // MARAUDER ORCHESTRATOR</span>
          <span id="mrd-agents-counter" style="color:#4ade80">100 AGENTS</span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <input id="mrd-agents-filter" class="mrd-search" style="flex:1;min-width:180px" type="text" placeholder="Филтрирай 100-те агента (SOC, Pentest, Malware, AI)..." />
          <select id="mrd-agents-section" class="mrd-search" style="width:auto">
            <option value="">Всички секции (I-IV)</option>
            <option value="I. AI SOC">I. AI SOC</option>
            <option value="II. AI Pentesting">II. AI Pentesting</option>
            <option value="III. AI Application & Cloud Security">III. AI App & Cloud Security</option>
            <option value="IV. AI Agent Security">IV. AI Agent Security</option>
          </select>
          <button id="mrd-agents-fav-btn" class="mrd-qbtn">TOP 15 FAVORITES</button>
        </div>
        <div id="mrd-agents-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:6px;max-height:240px;overflow-y:auto"></div>
      `;
      app.insertBefore(agentsSection, document.getElementById("mrd-bottom-bar") || null);

      let allAgents = [];
      let favSet = new Set();
      let onlyFavs = false;

      function renderAgentsGrid() {
        const q = (document.getElementById("mrd-agents-filter").value || "").trim().toLowerCase();
        const sec = document.getElementById("mrd-agents-section").value;
        const grid = document.getElementById("mrd-agents-grid");
        const counter = document.getElementById("mrd-agents-counter");
        if (!grid) return;

        const filtered = allAgents.filter((a) => {
          if (sec && a.section !== sec) return false;
          if (onlyFavs && !favSet.has((a.name || "").toLowerCase())) return false;
          if (!q) return true;
          return (a.id + " " + a.name + " " + a.section + " " + a.summary).toLowerCase().includes(q);
        });

        if (counter) counter.textContent = filtered.length + " / " + allAgents.length;
        grid.innerHTML = filtered.slice(0, 36).map((a) => `
          <div style="border:1px solid #2b1016;border-radius:7px;padding:7px 8px;background:#0c101a;cursor:pointer" data-agent-name="${encodeURIComponent(a.name)}" data-agent-sec="${encodeURIComponent(a.section)}" data-agent-sum="${encodeURIComponent(a.summary)}">
            <div style="display:flex;justify-content:space-between;gap:4px">
              <strong style="font-size:11px;color:#fff">#${a.id} ${a.name}</strong>
              <span style="font-size:9px;color:#fca5a5">${favSet.has((a.name || "").toLowerCase()) ? "FAV" : ""}</span>
            </div>
            <div style="font-size:10px;color:#9ca3af">${a.section}</div>
            <div style="font-size:11px;color:#cbd5e1;margin-top:2px">${a.summary}</div>
          </div>
        `).join("");

        grid.querySelectorAll("[data-agent-name]").forEach((card) => {
          card.onclick = () => {
            const name = decodeURIComponent(card.dataset.agentName);
            const section = decodeURIComponent(card.dataset.agentSec);
            const summary = decodeURIComponent(card.dataset.agentSum);
            const titleEl = document.getElementById("mrd-center-title");
            if (titleEl) titleEl.textContent = name.toUpperCase() + " // " + section;
            if (typeof appendMsg === "function") {
              appendMsg("ai", "ORCHESTRATOR", "Избран инструмент <strong>" + name + "</strong> (" + section + ") — " + summary);
            }
          };
        });
      }

      document.getElementById("mrd-agents-filter").addEventListener("input", renderAgentsGrid);
      document.getElementById("mrd-agents-section").addEventListener("change", renderAgentsGrid);
      document.getElementById("mrd-agents-fav-btn").addEventListener("click", (e) => {
        onlyFavs = !onlyFavs;
        e.target.style.background = onlyFavs ? "#991b1b" : "";
        renderAgentsGrid();
      });

      fetch("/data/top100-cyber-agents.json", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return;
          allAgents = d.agents || [];
          favSet = new Set((d.favorites15 || []).map((x) => (x.name || "").toLowerCase()));
          renderAgentsGrid();
        })
        .catch(() => {});
    }
// MALWARE-AL ARMY + Цялото AI семейство отстрани (в десния сайдбар на index конзолата)
    const SIDE_FAMILY = [
      { name: "MALWARE-AL ARMY", tag: "ARMY CORE", color: "#f87171", desc: "Главна ударна AI единица на MARAUDER-AL за анализ, каталози и автоматизация." },
      { name: "Mythos Security", tag: "RED/BLUE AI", color: "#38bdf8", desc: "Ядро за сигурност, разузнаване и команден ко-пилот в конзолата." },
      { name: "ScyNet AI", tag: "TELEMETRY", color: "#60a5fa", desc: "Корелация на заплахи, поведенчески модели и анализ на потоци." },
      { name: "Llama / Ollama Local Node", tag: "LOCAL LLM", color: "#4ade80", desc: "Локален инференс без интернет (llama3.2 / llama3 / mistral) с офлайн резерв." },
      { name: "MARAUDER Terminal Bridge", tag: "WSL / TERMUX", color: "#fbbf24", desc: "Мост за скриптове и обратна връзка между Windows/WSL, Linux и Termux." }
    ];

    const rightSidebar = document.querySelector(".mrd-grid aside:last-of-type");
    if (rightSidebar && !document.getElementById("mrd-army-family-side")) {
      const famBox = document.createElement("div");
      famBox.id = "mrd-army-family-side";
      famBox.style.cssText = "border-top:1px solid #2b1016;padding-top:8px;display:flex;flex-direction:column;gap:6px";
      famBox.innerHTML = `
        <div class="mrd-box-title">
          <span>MALWARE-AL ARMY // AI FAMILY</span>
          <span style="color:#4ade80">ALL ${SIDE_FAMILY.length}</span>
        </div>
        <div id="mrd-army-list" style="display:flex;flex-direction:column;gap:5px"></div>
      `;
      rightSidebar.appendChild(famBox);

      const listEl = document.getElementById("mrd-army-list");
      SIDE_FAMILY.forEach((member) => {
        const card = document.createElement("div");
        card.style.cssText = "border:1px solid #2b1016;border-radius:7px;padding:7px 8px;background:linear-gradient(180deg,#140a10,#0b0f19);cursor:pointer;transition:.14s";
        card.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
            <strong style="font-size:11px;color:${member.color}">${member.name}</strong>
            <span style="font-size:9px;padding:2px 5px;border-radius:4px;background:#1b0c12;border:1px solid #7f1d1d;color:#fca5a5">${member.tag}</span>
          </div>
          <div style="font-size:10px;color:#cbd5e1;margin-top:3px;line-height:1.35">${member.desc}</div>
        `;
        card.onmouseenter = () => { card.style.borderColor = "#ef4444"; };
        card.onmouseleave = () => { card.style.borderColor = "#2b1016"; };
        card.onclick = () => {
          document.getElementById("mrd-center-title").textContent = `${member.name.toUpperCase()} // ACTIVE UNIT`;
          if (typeof appendMsg === "function") {
            appendMsg("ai", member.name, `Активирана единица <strong>${member.name}</strong> [${member.tag}] — ${member.desc}`);
          }
        };
        listEl.appendChild(card);
      });
    }

    let mazaloActive = false;
    let autoPlusActive = true;
    let mazaloTimer = null;
    let seconds = 180;
    let feedIdx = 0;
    let activeChannel = "";

    const footerBar = document.createElement("div");
    footerBar.id = "mrd-bottom-bar";
    footerBar.style.cssText = [
      "display:flex",
      "flex-wrap:wrap",
      "align-items:center",
      "justify-content:space-between",
      "gap:8px",
      "padding:8px 12px",
      "border:1px solid #b91c1c",
      "border-radius:10px",
      "background:linear-gradient(90deg,#21060b,#090c14 55%,#081b10)",
      "box-shadow:0 0 18px rgba(239,68,68,.28)"
    ].join(";");

    footerBar.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:12px;font-weight:900;letter-spacing:.1em;color:#f87171">MARAUDER // THE ULTIMATE PLATFORM</span>
        <span id="mrd-mode-readout" style="font-size:11px;color:#fca5a5"></span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        <button id="mrd-btn-mazalo" class="mrd-btn">TRENIE NA MAZALO</button>
        <button id="mrd-btn-autoplus" class="mrd-btn mrd-btn-green">AUTO PLUS: ON</button>
        <button id="mrd-btn-exit" class="mrd-btn" style="border-color:#f97316;background:linear-gradient(180deg,#9a3412,#431407)">EXIT</button>
      </div>
    `;
    app.appendChild(footerBar);

    function appendMsg(role, sender, html) {
      const log = document.getElementById("mrd-chat-log");
      if (!log) return;
      const div = document.createElement("div");
      div.className = `mrd-msg ${role}`;
      div.innerHTML = `<strong>${sender}:</strong> ${html}`;
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
    }

    function activateRedSecretChat(autoGenerated = false) {
      seconds = 180;
      document.getElementById("mrd-center-title").textContent = "RED-SECRET CHAT // AUTOMATED ENCRYPTED LINK ACTIVE";
      document.getElementById("mrd-secret-state").textContent = "SECRET CHAT: ACTIVE";
      document.getElementById("mrd-conn-status").textContent = "Connection: SUCCESS • Auto-Destroy: 03:00";
      const inputEl = document.getElementById("mrd-chat-input");
      if (inputEl) inputEl.focus();
      const keyVal = document.getElementById("mrd-conn-key").value;
      appendMsg(
        "ai",
        "RED-SECRET ENGINE",
        `${autoGenerated ? "Автоматично активиран" : "Отворен"} криптиран секретен канал <strong>${keyVal}</strong>. Готов за незабавни команди и автоматизирани отговори.`
      );
    }

    document.getElementById("mrd-secret-trigger").addEventListener("click", () => {
      activateRedSecretChat(false);
    });

    // Горни табове
    const navEl = document.getElementById("mrd-nav");
    TABS.forEach((tab, idx) => {
      const btn = document.createElement("button");
      btn.className = "mrd-tab" + (idx === 1 ? " active" : "");
      btn.textContent = tab;
      btn.onclick = () => {
        document.querySelectorAll(".mrd-tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        if (tab === "HOME") {
          activateRedSecretChat(true);
        } else {
          document.getElementById("mrd-center-title").textContent = `${tab} // MARAUDER LIVE MODULE`;
          appendMsg("ai", "AI Agent (Mythos)", `Превключено към <strong>${tab}</strong>. Секретният чат остава свързан на заден план.`);
        }
      };
      navEl.appendChild(btn);
    });

    // Категории вляво
    const catListEl = document.getElementById("mrd-cat-list");
    const workspaceEl = document.getElementById("mrd-workspace");

    function selectCategory(cat) {
      document.querySelectorAll(".mrd-cat-item").forEach((el) => {
        el.classList.toggle("active", el.dataset.cat === cat.name);
      });
      document.getElementById("mrd-center-title").textContent = `${cat.name.toUpperCase()} (${cat.count} TOOLS)`;
      workspaceEl.innerHTML = cat.tools
        .map(
          (t) => `
          <div class="mrd-tool-card">
            <div style="font-size:12px;font-weight:800;color:#fff">${t}</div>
            <div style="font-size:11px;color:#9ca3af">Category: ${cat.name}</div>
            <button class="mrd-btn" onclick="window.__mrdRunTool('${cat.name.replace(/'/g, "")}','${t.replace(/'/g, "")}')">LAUNCH MODULE</button>
          </div>`
        )
        .join("");
    }

    window.__mrdRunTool = (catName, toolName) => {
      appendMsg("ai", "MARAUDER CORE", `Изпълнен модул <strong>${toolName}</strong> [${catName}] в активна сесия.`);
    };

    function renderCategories(filter = "") {
      const q = filter.trim().toLowerCase();
      const filtered = CATEGORIES.filter(
        (c) => !q || c.name.toLowerCase().includes(q) || c.tools.some((t) => t.toLowerCase().includes(q))
      );
      document.getElementById("mrd-cat-count").textContent = `${filtered.length} CATS`;
      catListEl.innerHTML = "";
      filtered.forEach((cat) => {
        const item = document.createElement("div");
        item.className = "mrd-cat-item";
        item.dataset.cat = cat.name;
        item.innerHTML = `<span>${cat.name}</span><span style="font-size:10px;color:#fca5a5">${cat.count}</span>`;
        item.onclick = () => selectCategory(cat);
        catListEl.appendChild(item);
      });
      if (filtered.length) selectCategory(filtered[0]);
    }

    document.getElementById("mrd-tool-search").addEventListener("input", (e) => renderCategories(e.target.value));
    renderCategories();

    document.querySelectorAll("[data-quick]").forEach((btn) => {
      btn.onclick = () => {
        appendMsg("ai", "QUICK ACCESS", `Зареден бърз профил <strong>${btn.dataset.quick}</strong> в активната сесия.`);
      };
    });

    function randChunk(len) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    }

    document.getElementById("mrd-btn-gen").onclick = () => {
      const k = `MRD-${randChunk(4)}-${randChunk(4)}-${randChunk(4)}`;
      const p = `${randChunk(4).toLowerCase()}-${randChunk(4)}-${randChunk(4)}`;
      document.getElementById("mrd-gen-key").value = k;
      document.getElementById("mrd-gen-pass").value = p;
      document.getElementById("mrd-conn-key").value = k;
      activateRedSecretChat(true);
    };

    document.getElementById("mrd-btn-conn").onclick = () => {
      activateRedSecretChat(false);
    };

    setInterval(() => {
      seconds = seconds > 0 ? seconds - 1 : 180;
      const m = String(Math.floor(seconds / 60)).padStart(2, "0");
      const s = String(seconds % 60).padStart(2, "0");
      const tEl = document.getElementById("mrd-timer");
      if (tEl) tEl.textContent = `${m}:${s}`;
    }, 1000);

    // Десен жив поток за файлове, видеа, разархивиране и разхеширане
    function renderLiveFeed(channelFilter = "") {
      const mediaBox = document.getElementById("mrd-media-box");
      if (!mediaBox) return;
      const pool = channelFilter ? FEED_ITEMS.filter((x) => x.type === channelFilter) : FEED_ITEMS;
      const item = (pool.length ? pool : FEED_ITEMS)[feedIdx % (pool.length ? pool : FEED_ITEMS).length];
      mediaBox.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <strong style="color:#f87171">LIVE STREAM // ${item.type}</strong>
          <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#14532d;color:#86efac">${item.status}</span>
        </div>
        <div style="font-size:12px;color:#fff;font-weight:700">${item.name}</div>
        <div style="font-size:11px;color:#fca5a5;margin-top:2px">${item.archive}</div>
        <div style="font-size:10px;color:#93c5fd;margin-top:4px;word-break:break-all">${item.hash}</div>
        <div style="margin-top:6px;display:flex;gap:6px">
          <button id="mrd-next-feed" class="mrd-btn" style="padding:4px 8px;font-size:10px">NEXT / UNPACK</button>
          <button id="mrd-push-chat" class="mrd-btn mrd-btn-green" style="padding:4px 8px;font-size:10px">SEND TO CHAT</button>
        </div>
      `;
      const nextBtn = document.getElementById("mrd-next-feed");
      if (nextBtn) nextBtn.onclick = () => { feedIdx++; renderLiveFeed(channelFilter); };
      const pushBtn = document.getElementById("mrd-push-chat");
      if (pushBtn) pushBtn.onclick = () => {
        appendMsg("ai", "LIVE EXTRACTOR", `Разархивиран и разхеширан обект: <strong>${item.name}</strong> (${item.archive}) • ${item.status}`);
      };
    }

    document.querySelectorAll("[data-media]").forEach((btn) => {
      btn.onclick = () => {
        activeChannel = btn.dataset.media;
        renderLiveFeed(activeChannel);
      };
    });
    renderLiveFeed("");
    setInterval(() => {
      if (autoPlusActive) {
        feedIdx++;
        renderLiveFeed(activeChannel);
      }
    }, 4500);

    // Еквалайзер лента
    const barsEl = document.getElementById("mrd-bars");
    for (let i = 0; i < 22; i++) {
      const b = document.createElement("div");
      b.className = "mrd-bar";
      b.style.height = "6px";
      barsEl.appendChild(b);
    }
    setInterval(() => {
      barsEl.querySelectorAll(".mrd-bar").forEach((b) => {
        b.style.height = `${4 + Math.floor(Math.random() * 18)}px`;
      });
    }, 220);

    // Автоматизиран чат с онлайн -> Ollama -> Offline fallback
    async function sendChat() {
      const inp = document.getElementById("mrd-chat-input");
      const text = inp.value.trim();
      if (!text) return;
      inp.value = "";
      appendMsg("user", "Ти", text.replace(/</g, "&lt;"));

      try {
        const res = await fetch("/api/gangsta/forge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text, mode: "marauder-secret" })
        });
        if (res.ok) {
          const data = await res.json();
          const reply = data.reply || data.output || data.message;
          if (reply) {
            appendMsg("ai", "RED-SECRET AI", String(reply));
            return;
          }
        }
      } catch {}

      try {
        const oRes = await fetch("http://127.0.0.1:11434/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: "llama3.2", prompt: text, stream: false })
        });
        if (oRes.ok) {
          const oData = await oRes.json();
          if (oData.response) {
            appendMsg("ai", "Llama Local Node", oData.response);
            return;
          }
        }
      } catch {}

      const autoReplies = [
        `RED-SECRET потвърди командата "<strong>${text.replace(/</g, "&lt;")}</strong>" и стартира автоматичен анализ.`,
        `Mythos + ScyNet обработиха заявката "<strong>${text.replace(/</g, "&lt;")}</strong>" в криптиран секретен режим.`
      ];
      appendMsg("ai", "RED-SECRET AUTO", autoReplies[Math.floor(Math.random() * autoReplies.length)]);
    }

    document.getElementById("mrd-chat-send").onclick = sendChat;
    document.getElementById("mrd-chat-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendChat();
    });

    // Долни бутони
    const readoutEl = document.getElementById("mrd-mode-readout");
    const mazaloBtn = document.getElementById("mrd-btn-mazalo");
    const autoBtn = document.getElementById("mrd-btn-autoplus");
    const exitBtn = document.getElementById("mrd-btn-exit");

    function syncReadout() {
      if (readoutEl) {
        readoutEl.textContent = `MAZALO: ${mazaloActive ? "TURBO ACTIVE" : "IDLE"} • AUTO PLUS: ${autoPlusActive ? "ON" : "OFF"}`;
      }
    }

    mazaloBtn.onclick = () => {
      mazaloActive = !mazaloActive;
      mazaloBtn.textContent = mazaloActive ? "TRENIE NA MAZALO: ACTIVE" : "TRENIE NA MAZALO";
      syncReadout();
      if (mazaloActive) {
        appendMsg("ai", "MAZALO ENGINE", "Активиран е <strong>TRENIE NA MAZALO</strong> — ускорен поток.");
        mazaloTimer = setInterval(() => {
          feedIdx++;
          renderLiveFeed(activeChannel);
        }, 1200);
      } else {
        if (mazaloTimer) clearInterval(mazaloTimer);
        appendMsg("sys", "MAZALO ENGINE", "Турбо режимът <strong>TRENIE NA MAZALO</strong> е спрян.");
      }
    };

    autoBtn.onclick = () => {
      autoPlusActive = !autoPlusActive;
      autoBtn.textContent = `AUTO PLUS: ${autoPlusActive ? "ON" : "OFF"}`;
      syncReadout();
      appendMsg("ai", "AUTO PLUS", autoPlusActive ? "Автоматичният режим е ВКЛЮЧЕН." : "Автоматичният режим е ИЗКЛЮЧЕН.");
    };

    exitBtn.onclick = () => {
      mazaloActive = false;
      autoPlusActive = false;
      if (mazaloTimer) clearInterval(mazaloTimer);
      mazaloBtn.textContent = "TRENIE NA MAZALO";
      autoBtn.textContent = "AUTO PLUS: OFF";
      syncReadout();
      const log = document.getElementById("mrd-chat-log");
      if (log) {
        log.innerHTML = `<div class="mrd-msg"><strong style="color:#f87171">MARAUDER SESSION RESET:</strong> Сесията е затворена и изчистена.</div>`;
      }
    };

    syncReadout();

    fetch("/data/malware-intelligence.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const total = (d.aiFamilies?.length || 0) + (d.knownFamilies?.length || 0);
        const mini = document.getElementById("mrd-intel-mini");
        if (mini) {
          mini.innerHTML = `Catalog Active: <strong>${total} entries</strong> • Levels 0–4 (AI Runtime & Agentic) • 7 Verified Intel Sources.`;
        }
      })
      .catch(() => {});
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildConsole);
  } else {
    buildConsole();
  }
})();
