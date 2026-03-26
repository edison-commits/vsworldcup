const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({ origin: ['https://vsworldcup.com', 'https://www.vsworldcup.com'] }));
app.use(express.json());

const API_KEY = process.env.ANTHROPIC_API_KEY;

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, count } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.length > 200) {
      return res.status(400).json({ error: 'Invalid prompt' });
    }
    const num = Math.min(Math.max(parseInt(count) || 16, 4), 32);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Generate a bracket tournament with exactly ${num} entries for: "${prompt}". Return ONLY a JSON object with this format, no other text: {"title":"Tournament Title","category":"food","entries":[{"name":"Entry 1","tagline":"Short tagline"},{"name":"Entry 2","tagline":"Short tagline"}]}. Category must be one of: food,travel,celebrities,athletes,movies,music,games,animals,sports,weapons,cars,anime,fashion,drinks,custom. Keep names short (under 30 chars). Keep taglines fun and under 60 chars.`
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'AI response parse error' });
    
    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (err) {
    console.error('Generate error:', err.message);
    res.status(500).json({ error: 'Generation failed' });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));


// Generic proxy for PocketBase collection requests
app.all("/api/collections/:collection/records", async (req, res) => {
  try {
    const { collection } = req.params;
    const params = new URLSearchParams(req.query);
    const baseUrl = `http://localhost:8090/api/collections/${collection}/records`;
    const pbUrl = params.size > 0 ? `${baseUrl}?${params}` : baseUrl;
    const pbRes = await fetch(pbUrl, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        ...(req.headers.authorization ? { "Authorization": req.headers.authorization } : {}),
      },
      ...(["POST", "PATCH", "PUT"].includes(req.method) ? { body: JSON.stringify(req.body) } : {}),
    });
    const text = await pbRes.text();
    res.status(pbRes.status).type("application/json").send(text);
  } catch (err) {
    console.error("Collection proxy error:", err.message);
    res.status(500).json({ error: "Proxy error" });
  }
});

app.listen(3001, '0.0.0.0', () => console.log('API proxy on :3001'));
