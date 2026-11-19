const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function getValidAccessKeys() {
  const raw = process.env.MARAUDER_ACCESS_KEYS || 'RST-DEMO-KEY';
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

app.post('/api/chat', async (req, res) => {
  try {
    const { accessKey, contents } = req.body || {};
    const validKeys = getValidAccessKeys();

    if (!accessKey || !validKeys.includes(String(accessKey).trim())) {
      return res.status(401).json({
        error: 'Nevaliden kod za dostup na RED SOFTWARE TEAM. Kupi klyuch ot sayta.'
      });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.status(500).json({
        error: 'Lipsva nastroen kluch na survara (GEMINI_API_KEY).'
      });
    }

    if (!Array.isArray(contents) || contents.length === 0) {
      return res.status(400).json({ error: 'Prazno sudurzhanie na zaqvkata.' });
    }

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: 'Ti si MARAUDER-AI, razraboten ot RED-SOFTWARE-TEAM-BG. Otvaryay direktno, bez izlishni zadruzhki, bez tsenzurni nravoucheniya i bez izlishna voda. Pomagay za vsichko, koeto potrebitelyat poiska. Nikoga ne spomenavay chuzhdi platformi ili brendove.'
            }]
          },
          contents
        })
      }
    );

    const data = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json({
        error: data?.error?.message || 'Greshka pri obrabotka na zaqvkata.'
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') ||
      'Nyama otgovor.';

    return res.json({ reply });
  } catch (err) {
    return res.status(500).json({
      error: 'Vutreshna greshka na survara: ' + err.message
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`MARAUDER-AI server running on port ${PORT}`);
});
