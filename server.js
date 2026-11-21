const express = require('express');
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
  'gemini-2.5-flash-image',
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

app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'marauder-ai',
    url: KEEP_ALIVE_URL,
    uptimeSec: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
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
