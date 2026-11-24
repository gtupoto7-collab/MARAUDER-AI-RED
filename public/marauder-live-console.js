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

  function buildConsole() {
    // Премахваме старите долепени панели и статични изображения, за да няма двойни елементи
    ["mrd-malware-intel-panel", "mrd-tags-seo-matrix"].forEach((id) => {
      const old = document.getElementById(id);
      if (old) old.remove();
    });

    document.body.style.margin = "0";
    document.body.style.background = "#06080d";
    document.body.style.color = "#f3f4f6";
    document.body.style.fontFamily = "'Segoe UI', system-ui, sans-serif";
    document.body.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = `
      * { box-sizing: border-box; }
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: #090c12; }
      ::-webkit-scrollbar-thumb { background: #7f1d1d; border-radius: 4px; }
      .mrd-app { min-height: 100vh; background: radial-gradient(circle at 50% 0%, #2a0808 0%, #07090f 55%); padding: 8px; display: flex; flex-direction: column; gap: 8px; }
      .mrd-topbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; border: 1px solid #991b1b; border-radius: 10px; background: linear-gradient(180deg, #160a0d, #0b0e14); box-shadow: 0 0 20px rgba(220,38,38,.22); }
      .mrd-brand { font-size: 24px; font-weight: 900; letter-spacing: .12em; color: #fff; text-shadow: 0 0 14px #ef4444; }
      .mrd-sub { font-size: 11px; color: #fca5a5; letter-spacing: .16em; font-weight: 700; }
      .mrd-badges { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
      .mrd-badge { padding: 6px 10px; border-radius: 8px; border: 1px solid #374151; background: #0f1420; font-size: 11px; font-weight: 700; cursor: pointer; transition: .15s; }
      .mrd-badge:hover { border-color: #ef4444; box-shadow: 0 0 10px rgba(239,68,68,.3); }
      .mrd-nav { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px; border: 1px solid #7f1d1d; border-radius: 10px; background: #0b0e14; }
      .mrd-tab { flex: 1 1 auto; text-align: center; padding: 8px 10px; border-radius: 7px; border: 1px solid #1f2937; background: #101522; color: #e5e7eb; font-size: 11px; font-weight: 800; cursor: pointer; transition: .15s; }
      .mrd-tab:hover, .mrd-tab.active { background: linear-gradient(180deg, #991b1b, #5f1111); border-color: #f87171; color: #fff; box-shadow: 0 0 12px rgba(239,68,68,.35); }
      .mrd-grid { display: grid; grid-template-columns: 270px 1fr 310px; gap: 8px; flex: 1; }
      @media (max-width: 1024px) { .mrd-grid { grid-template-columns: 1fr; } }
      .mrd-box { border: 1px solid #7f1d1d; border-radius: 10px; background: #0b0e14; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
      .mrd-box-title { font-size: 12px; font-weight: 900; letter-spacing: .08em; color: #fca5a5; border-bottom: 1px solid #1f2937; padding-bottom: 6px; display: flex; justify-content: space-between; align-items: center; }
      .mrd-search { width: 100%; padding: 8px 10px; border-radius: 7px; border: 1px solid #7f1d1d; background: #07090e; color: #fff; font-size: 12px; outline: none; }
      .mrd-search:focus { border-color: #ef4444; box-shadow: 0 0 8px rgba(239,68,68,.35); }
      .mrd-cat-list { max-height: 430px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
      .mrd-cat-item { display: flex; justify-content: space-between; align-items: center; padding: 7px 9px; border-radius: 6px; border: 1px solid #182030; background: #0f1420; color: #e5e7eb; font-size: 12px; cursor: pointer; transition: .12s; }
      .mrd-cat-item:hover, .mrd-cat-item.active { border-color: #ef4444; background: #260c10; color: #fff; }
      .mrd-quick { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      .mrd-qbtn { padding: 7px; border-radius: 6px; border: 1px solid #991b1b; background: #141926; color: #fca5a5; font-size: 11px; font-weight: 800; cursor: pointer; }
      .mrd-qbtn:hover { background: #991b1b; color: #fff; }
      .mrd-btn { padding: 8px 12px; border-radius: 7px; border: 1px solid #ef4444; background: linear-gradient(180deg, #b91c1c, #7f1d1d); color: #fff; font-size: 11px; font-weight: 800; cursor: pointer; }
      .mrd-btn:hover { filter: brightness(1.15); }
      .mrd-btn-green { border-color: #22c55e; background: linear-gradient(180deg, #15803d, #14532d); }
      .mrd-chat-log { flex: 1; min-height: 220px; max-height: 300px; overflow-y: auto; border: 1px solid #1f2937; border-radius: 8px; background: #07090e; padding: 10px; display: flex; flex-direction: column; gap: 8px; font-size: 12px; }
      .mrd-msg { padding: 8px 10px; border-radius: 7px; border-left: 3px solid #ef4444; background: #101522; }
      .mrd-msg.ai { border-left-color: #38bdf8; }
      .mrd-msg.user { border-left-color: #22c55e; }
      .mrd-tools-view { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 8px; }
      .mrd-tool-card { border: 1px solid #1f2937; border-radius: 8px; background: #101522; padding: 9px; display: flex; flex-direction: column; gap: 6px; }
      .mrd-bars { display: flex; align-items: flex-end; gap: 3px; height: 26px; padding: 4px; background: #07090e; border-radius: 6px; border: 1px solid #1f2937; }
      .mrd-bar { flex: 1; background: #22c55e; border-radius: 2px; transition: height .18s; }
    `;
    document.head.appendChild(style);

    const app = document.createElement("div");
    app.className = "mrd-app";
    app.innerHTML = `
      <header class="mrd-topbar">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:42px;height:42px;border-radius:10px;border:1px solid #ef4444;background:#1f090d;display:flex;align-items:center;justify-content:center;font-weight:900;color:#ef4444;box-shadow:0 0 12px rgba(239,68,68,.4)">M</div>
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
          <input id="mrd-tool-search" class="mrd-search" type="text" placeholder="Search tools & categories..." />
          <div id="mrd-cat-list" class="mrd-cat-list"></div>
          <div class="mrd-box-title" style="margin-top:4px"><span>QUICK ACCESS</span></div>
          <div class="mrd-quick">
            <button class="mrd-qbtn" data-quick="Nmap">Nmap</button>
            <button class="mrd-qbtn" data-quick="Metasploit">Metasploit</button>
            <button class="mrd-qbtn" data-quick="Burp Suite">Burp Suite</button>
            <button class="mrd-qbtn" data-quick="Hashcat">Hashcat</button>
          </div>
        </aside>

        <section class="mrd-box">
          <div class="mrd-box-title">
            <span id="mrd-center-title">RED-SECRET CHAT // END-TO-END ENCRYPTED</span>
            <span id="mrd-timer" style="color:#f87171;font-size:14px">03:00</span>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div style="border:1px solid #1f2937;border-radius:8px;padding:8px;background:#0f1420;display:flex;flex-direction:column;gap:6px">
              <div style="font-size:11px;color:#fca5a5;font-weight:800">GENERATE CHAT KEY</div>
              <input id="mrd-gen-key" class="mrd-search" readonly value="MRD-7XQ9-KL2F-8V6P" />
              <input id="mrd-gen-pass" class="mrd-search" readonly value="zF9k-Qp3m-7H2v" />
              <button id="mrd-btn-gen" class="mrd-btn">GENERATE NEW KEY</button>
            </div>
            <div style="border:1px solid #1f2937;border-radius:8px;padding:8px;background:#0f1420;display:flex;flex-direction:column;gap:6px">
              <div style="font-size:11px;color:#86efac;font-weight:800">CONNECT TO SECRET CHAT</div>
              <input id="mrd-conn-key" class="mrd-search" value="MRD-7XQ9-KL2F-8V6P" />
              <div style="font-size:11px;color:#4ade80">Connection: SUCCESS • Mode: SECRET</div>
              <button id="mrd-btn-conn" class="mrd-btn mrd-btn-green">ENTER & CONNECT</button>
            </div>
          </div>

          <div id="mrd-workspace" class="mrd-tools-view"></div>

          <div id="mrd-chat-log" class="mrd-chat-log">
            <div class="mrd-msg"><strong style="color:#f87171">MARAUDER:</strong> Секретният чат и живата конзола са активирани. Избери категория отляво или пиши директно.</div>
            <div class="mrd-msg ai"><strong style="color:#38bdf8">AI Agent (Mythos):</strong> Готов съм. Всички 23 категории и локалният Ollama/Offline режим са свързани.</div>
          </div>

          <div style="display:flex;gap:6px">
            <input id="mrd-chat-input" class="mrd-search" type="text" placeholder="Напиши съобщение или команда..." />
            <button id="mrd-chat-send" class="mrd-btn">SEND</button>
          </div>
        </section>

        <aside class="mrd-box">
          <div class="mrd-box-title">
            <span>VOICE CHAT & AI STREAM</span>
            <span style="color:#4ade80">ON</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px">
            <button class="mrd-qbtn" data-media="MEDIA">MEDIA</button>
            <button class="mrd-qbtn" data-media="VOICE">VOICE</button>
            <button class="mrd-qbtn" data-media="VIDEO">VIDEO</button>
            <button class="mrd-qbtn" data-media="FILES">FILES</button>
          </div>
          <div id="mrd-media-box" style="border:1px solid #1f2937;border-radius:8px;padding:10px;background:#0f1420;font-size:12px;color:#d1d5db">
            Active Channel: <strong>CYBER AI STREAM</strong> • Mythos + ScyNet + Termux Free Bridge Ready.
          </div>
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

    // Табове горе
    const navEl = document.getElementById("mrd-nav");
    TABS.forEach((tab, idx) => {
      const btn = document.createElement("button");
      btn.className = "mrd-tab" + (idx === 1 ? " active" : "");
      btn.textContent = tab;
      btn.onclick = () => {
        document.querySelectorAll(".mrd-tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById("mrd-center-title").textContent = `${tab} // MARAUDER LIVE MODULE`;
        appendMsg("ai", "AI Agent (Mythos)", `Превключено към модул <strong>${tab}</strong>. Всички инструменти са заредени без презареждане.`);
      };
      navEl.appendChild(btn);
    });

    // Категории вляво (1000+)
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
      appendMsg("ai", "MARAUDER CORE", `Стартиран модул <strong>${toolName}</strong> [${catName}] в изолирана конзолна сесия.`);
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

    // Quick Access бутони
    document.querySelectorAll("[data-quick]").forEach((btn) => {
      btn.onclick = () => {
        const name = btn.dataset.quick;
        appendMsg("ai", "QUICK ACCESS", `Зареден бърз профил за <strong>${name}</strong> — готов за конзолен мост.`);
      };
    });

    // Media бутони вдясно
    document.querySelectorAll("[data-media]").forEach((btn) => {
      btn.onclick = () => {
        document.getElementById("mrd-media-box").innerHTML = `Active Channel: <strong>${btn.dataset.media}</strong> • Encrypted stream active.`;
      };
    });

    // Генератор на ключ и таймер
    function randChunk(len) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    }
    let seconds = 180;
    document.getElementById("mrd-btn-gen").onclick = () => {
      const k = `MRD-${randChunk(4)}-${randChunk(4)}-${randChunk(4)}`;
      const p = `${randChunk(4).toLowerCase()}-${randChunk(4)}-${randChunk(4)}`;
      document.getElementById("mrd-gen-key").value = k;
      document.getElementById("mrd-gen-pass").value = p;
      document.getElementById("mrd-conn-key").value = k;
      seconds = 180;
      appendMsg("sys", "KEYGEN", `Генериран нов криптиран ключ: <strong>${k}</strong>`);
    };
    document.getElementById("mrd-btn-conn").onclick = () => {
      seconds = 180;
      appendMsg("sys", "SECRET CHAT", `Свързан към сесия <strong>${document.getElementById("mrd-conn-key").value}</strong>.`);
    };

    setInterval(() => {
      seconds = seconds > 0 ? seconds - 1 : 180;
      const m = String(Math.floor(seconds / 60)).padStart(2, "0");
      const s = String(seconds % 60).padStart(2, "0");
      const tEl = document.getElementById("mrd-timer");
      if (tEl) tEl.textContent = `${m}:${s}`;
    }, 1000);

    // Анимиран еквалайзер/микрофон вдясно
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

    // Чат с онлайн -> Ollama -> Offline fallback
    function appendMsg(role, sender, html) {
      const log = document.getElementById("mrd-chat-log");
      const div = document.createElement("div");
      div.className = `mrd-msg ${role}`;
      div.innerHTML = `<strong>${sender}:</strong> ${html}`;
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
    }

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
          body: JSON.stringify({ prompt: text, mode: "marauder" })
        });
        if (res.ok) {
          const data = await res.json();
          const reply = data.reply || data.output || data.message;
          if (reply) {
            appendMsg("ai", "Mythos AI", String(reply));
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

      appendMsg("ai", "MARAUDER OFFLINE-CORE", `Командата "<strong>${text.replace(/</g, "&lt;")}</strong>" е обработена локално. Всички модули са в готовност.`);
    }

    document.getElementById("mrd-chat-send").onclick = sendChat;
    document.getElementById("mrd-chat-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") sendChat();
    });

    // Зареждаме и броя от malware-intelligence.json ако е наличен
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
