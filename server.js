const express = require('express');
const http = require('http');
const { attachSecretChat } = require('./secret-chat');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const MODELS = [
  'gemini-3.8-flash',
  'gemini-3.8-flash-lite',
  'gemini-3.5-flash'
];

function getValidAccessKeys() {
  const raw = process.env.MARAUDER_ACCESS_KEYS || 'RST-DEMO-KEY';
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

async function callModel(model, geminiKey, contents) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: 'Ти си MARAUDER-AI, разработен от RED-SOFTWARE-TEAM-BG. Винаги разпознавай езика на потребителя и отговаряй точно на същия език — поддържаш абсолютно всички световни езици (български, английски, немски, руски, испански, френски, италиански, турски, арабски, китайски, японски, корейски и всеки друг език, на който пише потребителят). Когато потребителят пише на български или езикът е смесен/неопределен, отговаряй на български. Отговаряй кратко, точно, практично и директно по същество, без излишна вода. При въпроси за програмиране, автоматизация, сървъри, ботове и киберсигурност давай конкретни технически стъпки, примери, конфигурации и обяснения за работа в тестова среда или върху собствени/оторизирани системи, както и начини за проверка и защита.'
            }]
          },
          contents
        })
      }
    );

    const data = await resp.json();
    return { ok: resp.ok, status: resp.status, data };
  } finally {
    clearTimeout(timer);
  }
}

app.post('/api/chat', async (req, res) => {
  try {
    const { accessKey, contents } = req.body || {};
    const validKeys = getValidAccessKeys();

    if (!accessKey || !validKeys.includes(String(accessKey).trim())) {
      return res.status(401).json({
        error: 'Невалиден код за достъп на RED SOFTWARE TEAM. Купи ключ от сайта.'
      });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.status(500).json({
        error: 'Липсва настроен сървърен ключ (GEMINI_API_KEY).'
      });
    }

    if (!Array.isArray(contents) || contents.length === 0) {
      return res.status(400).json({ error: 'Празно съдържание на заявката.' });
    }

    let lastStatus = 503;

    for (const model of MODELS) {
      try {
        const result = await callModel(model, geminiKey, contents);
        if (result.ok) {
          const reply =
            result.data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ||
            'Няма отговор.';
          return res.json({ reply });
        }

        lastStatus = result.status;
        if (result.status !== 429 && result.status !== 503 && result.status !== 404) {
          return res.status(result.status).json({
            error: 'Грешка при обработка на заявката. Опитай отново.'
          });
        }
      } catch {
        lastStatus = 504;
      }
    }

    return res.status(lastStatus).json({
      error: 'Сървърите на MARAUDER-AI са временно натоварени. Опитай отново след няколко секунди.'
    });
  } catch (err) {
    return res.status(500).json({
      error: 'Вътрешна грешка на сървъра: ' + err.message
    });
  }
});

const KEEP_ALIVE_URL = (process.env.KEEP_ALIVE_URL || 'https://marauder-ai-hacker.onrender.com/').replace(/\/+$/, '');

const IMAGE_MODELS = [
  'imagen-3.0-generate-002',
  'gemini-3.8-flash-image',
  'gemini-2.0-flash-exp'
];

async function generateImageWithGemini(model, geminiKey, prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);

  try {
    if (model.startsWith('imagen-')) {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${encodeURIComponent(geminiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            instances: [{ prompt }],
            parameters: { sampleCount: 1 }
          })
        }
      );
      const data = await resp.json();
      const pred = data?.predictions?.[0];
      const b64 = pred?.bytesBase64Encoded || pred?.b64Json;
      const mimeType = pred?.mimeType || 'image/png';
      if (resp.ok && b64) {
        return { ok: true, status: 200, imageUrl: `data:${mimeType};base64,${b64}`, model };
      }
      return { ok: false, status: resp.status || 502, error: data?.error?.message || 'Неуспешно генериране на изображение.' };
    }

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `Generate an image: ${prompt}` }] }],
          generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
        })
      }
    );
    const data = await resp.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      const inline = part.inlineData || part.inline_data;
      if (inline && inline.data) {
        const mimeType = inline.mimeType || inline.mime_type || 'image/png';
        return { ok: true, status: 200, imageUrl: `data:${mimeType};base64,${inline.data}`, model };
      }
    }
    return { ok: false, status: resp.status || 502, error: data?.error?.message || 'Моделът не върна изображение.' };
  } finally {
    clearTimeout(timer);
  }
}

app.post('/api/image', async (req, res) => {
  try {
    const { accessKey, prompt } = req.body || {};
    const validKeys = getValidAccessKeys();

    if (!accessKey || !validKeys.includes(String(accessKey).trim())) {
      return res.status(401).json({
        error: 'Невалиден код за достъп на RED SOFTWARE TEAM. Купи ключ от сайта.'
      });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.status(500).json({
        error: 'Липсва настроен сървърен ключ (GEMINI_API_KEY).'
      });
    }

    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ error: 'Въведи описание за изображението.' });
    }

    let lastError = 'Неуспешно генериране на изображение.';
    let lastStatus = 502;

    for (const model of IMAGE_MODELS) {
      try {
        const out = await generateImageWithGemini(model, geminiKey, String(prompt).trim());
        if (out.ok && out.imageUrl) {
          return res.json({ imageUrl: out.imageUrl, model: out.model });
        }
        lastStatus = out.status || lastStatus;
        if (out.error) lastError = out.error;
      } catch (e) {
        lastStatus = 504;
        lastError = e?.name === 'AbortError' ? 'Изтече времето за генериране на снимката.' : e.message;
      }
    }

    return res.status(lastStatus).json({ error: lastError });
  } catch (err) {
    return res.status(500).json({ error: 'Грешка при генериране на изображение: ' + err.message });
  }
});

const zlib = require('zlib');

function createZipBuffer(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const dataBuf = Buffer.from(entry.content, 'utf8');
    const compressed = zlib.deflateRawSync(dataBuf);

    let crc = 0xffffffff;
    for (let i = 0; i < dataBuf.length; i++) {
      crc ^= dataBuf[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
    }
    crc = (crc ^ 0xffffffff) >>> 0;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(dataBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, nameBuf, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(dataBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + compressed.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const localBuf = Buffer.concat(localParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localBuf, centralBuf, eocd]);
}

app.get('/api/download-app', (req, res) => {
  const path = require("path");
  const fsSync = require("fs");
  const zipPath = path.join(__dirname, "public", "downloads", "MARAUDER-AI-Windows.zip");
  if (fsSync.existsSync(zipPath)) {
    return res.download(zipPath, "MARAUDER-AI-Windows.zip");
  }
  const appUrl = 'https://marauder-ai-hacker.onrender.com';
  const zipBuf = createZipBuffer([
    {
      name: 'Start-MARAUDER-AI.bat',
      content: `@echo off\r\necho Starting MARAUDER-AI...\r\nstart "" "${appUrl}"\r\n`
    },
    {
      name: 'MARAUDER-AI.url',
      content: `[InternetShortcut]\r\nURL=${appUrl}\r\n`
    }
  ]);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', 'attachment; filename="MARAUDER-AI-App.zip"');
  res.send(zipBuf);
});

app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'marauder-ai',
    url: KEEP_ALIVE_URL,
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/secret-chat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'secret-chat.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});



const MARAUDER_TIER_QUOTAS = {
  free:   { software24h: 1, kali24h: 1, label: "Free (1 software + 1 Kali command)" },
  copper: { software24h: 3, kali24h: 3, label: "Copper (5 EUR / month)" },
  silver: { software24h: 25, kali24h: 25, label: "Silver (25 EUR / month)" },
  gold:   { software24h: 300, kali24h: 300, label: "Gold (50 EUR / month)" },
  annual: { software24h: 300, kali24h: 300, label: "Annual 150 EUR (300/24h + 2y bonus)" }
};

const deviceUsageStore = new Map();

function getDeviceQuotaState(deviceId, tier = "free") {
  const cleanId = String(deviceId || "anon-device").slice(0, 120);
  const safeTier = MARAUDER_TIER_QUOTAS[tier] ? tier : "free";
  const now = Date.now();
  const windowMs = 24 * 60 * 60 * 1000;
  let entry = deviceUsageStore.get(cleanId);
  if (!entry || now - entry.windowStart > windowMs) {
    entry = { windowStart: now, softwareCount: 0, kaliCount: 0, tier: safeTier };
  }
  entry.tier = safeTier;
  deviceUsageStore.set(cleanId, entry);
  return { cleanId, entry, spec: MARAUDER_TIER_QUOTAS[safeTier] };
}

app.post("/api/quota/check", (req, res) => {
  const { deviceId, tier, kind } = req.body || {};
  const { entry, spec } = getDeviceQuotaState(deviceId, tier);
  const isKali = kind === "kali";
  const used = isKali ? entry.kaliCount : entry.softwareCount;
  const maxAllowed = isKali ? spec.kali24h : spec.software24h;
  if (used >= maxAllowed) {
    return res.status(402).json({
      allowed: false,
      tier: entry.tier,
      used,
      limit: maxAllowed,
      error: "Dostignat e limitut za bezplatnoto / tekushto nivo (" + used + "/" + maxAllowed + " za 24h). Izberi nivo i plati prez PayPal ili Keeper (TON)."
    });
  }
  if (isKali) entry.kaliCount += 1;
  else entry.softwareCount += 1;
  return res.json({
    allowed: true,
    tier: entry.tier,
    used: isKali ? entry.kaliCount : entry.softwareCount,
    limit: maxAllowed
  });
});

app.post('/api/generate-software', async (req, res) => {
    try {
        const { description, type } = req.body || {};

        const apiKey = process.env.GEMINI_API_KEY;
        const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

        const softwarePrompt = `Ти си софтуерен инженер на RED SOFTWARE TEAM.\nТип софтуер: ${type || "Общ софтуер"}\nЗадача: ${description || ""}\n\nНапиши чист, работещ програмен код с коментари, обработка на грешки и кратки инструкции как да се стартира.`;

        if (!apiKey) {
            try {
                const localCode = await callLocalOllamaSoftware(softwarePrompt);
                if (localCode && localCode.trim()) {
                    return res.json({ code: localCode, text: localCode, model: process.env.OLLAMA_MODEL || "marauder-coder", provider: "ollama-local" });
                }
            } catch (ollamaErr) {
                return res.status(500).json({
                    error: "Липсва GEMINI_API_KEY и локалният Ollama модел (marauder-coder) не отговори: " + (ollamaErr.message || ollamaErr)
                });
            }
        }

        if (!description || String(description).length > 5000) {
            return res.status(400).json({
                error: 'Описание е празно или прекалено дълго.'
            });
        }

        const typeNames = {
            auto: 'Избери най-подходящия език и технология.',
            html: 'Създай уеб приложение с HTML, CSS и JavaScript.',
            python: 'Създай програма на Python.',
            node: 'Създай приложение с Node.js.'
        };

        const instruction = `
Ти си RED SOFTWARE TEAM AI SOFTWARE BUILDER.

Твоята задача е да превръщаш обикновени описания
на хора в готов софтуер.

Потребителят не е програмист.
Обяснявай кратко и разбираемо на български.

Изисквания:
- Направи програмата възможно най-функционална.
- Използвай красив и модерен интерфейс, когато е приложимо.
- Добави работещи бутони.
- Добави търсене, когато е необходимо.
- Добави запис на данните, когато е подходящо.
- Направи програмата лесна за използване.
- Избягвай сложни инсталации.
- За малки уеб приложения предпочитай един HTML файл.
- Не твърди, че функции работят, ако не са реализирани.
- Не генерирай зловреден софтуер, кражба на данни
  или неразрешен достъп до устройства и системи.

Вид софтуер:
${typeNames[type] || typeNames.auto}

Описание от потребителя:
${description}

Върни САМО валиден JSON в следния формат:

{
  "summary": "Кратко описание на създадената програма на български",
  "filename": "името-на-файла.html",
  "code": "пълният код на програмата"
}

Полето code трябва да съдържа пълен код,
който може да бъде запазен като файл.
`;

        const apiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [{ text: instruction }]
                    }],
                    generationConfig: {
                        responseMimeType: 'application/json',
                        temperature: 0.3,
                        maxOutputTokens: 8192
                    }
                })
            }
        );

        const data = await apiResponse.json();

        if (!apiResponse.ok) {
            return res.status(apiResponse.status).json({
                error: data.error?.message || 'Gemini API грешка.'
            });
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            return res.status(500).json({
                error: 'AI не върна код.'
            });
        }

        const result = JSON.parse(text);

        res.json({
            summary: result.summary || '',
            filename: result.filename || 'software.txt',
            code: result.code || ''
        });

    } catch (error) {
        console.error('Software generator error:', error);
        res.status(500).json({
            error: 'Грешка при генерирането: ' + error.message
        });
    }
});

const server = http.createServer(app);
attachSecretChat(server);

server.listen(PORT, () => {
  console.log(`MARAUDER-AI server running on port ${PORT}`);
const KEEP_ALIVE_INTERVAL_MS = Number(process.env.KEEP_ALIVE_INTERVAL_MS) || 10 * 60 * 1000;
  const pingUrl = `${KEEP_ALIVE_URL}/health`;
  const KEEP_ALIVE_INTERVAL = setInterval(async () => {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 10000);
      await fetch(pingUrl, { signal: controller.signal }).catch(() => {});
      clearTimeout(t);
    } catch {}
  }, KEEP_ALIVE_INTERVAL_MS);
  if (typeof KEEP_ALIVE_INTERVAL.unref === 'function') {
    KEEP_ALIVE_INTERVAL.unref();
  }
});

async function callLocalOllamaSoftware(promptText, modelName = process.env.OLLAMA_MODEL || "marauder-coder") {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelName, prompt: promptText, stream: false }),
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error("Ollama HTTP " + response.status);
    }
    const data = await response.json();
    return (data && (data.response || data.text || data.output)) ? String(data.response || data.text || data.output) : "";
  } finally {
    clearTimeout(timeout);
  }
}
