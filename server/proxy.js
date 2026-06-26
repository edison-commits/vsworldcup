const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({ origin: ['https://vsworldcup.com', 'https://www.vsworldcup.com'] }));
app.use(express.json());

const API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const VALID_CATEGORIES = new Set([
  'food', 'travel', 'celebrities', 'athletes', 'movies', 'music', 'games',
  'animals', 'sports', 'weapons', 'cars', 'anime', 'fashion', 'drinks', 'custom'
]);

function extractBalancedJsonObject(text) {
  if (typeof text !== 'string') return null;

  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const start = cleaned.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i += 1) {
    const ch = cleaned[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }

  return null;
}

function validateGeneratedTournament(parsed, expectedCount) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Generated payload is not an object');
  }
  if (typeof parsed.title !== 'string' || !parsed.title.trim()) {
    throw new Error('Generated payload missing title');
  }
  if (typeof parsed.category !== 'string' || !VALID_CATEGORIES.has(parsed.category)) {
    parsed.category = 'custom';
  }
  if (!Array.isArray(parsed.entries)) {
    throw new Error('Generated payload missing entries');
  }
  if (parsed.entries.length !== expectedCount) {
    throw new Error(`Generated payload has ${parsed.entries.length} entries, expected ${expectedCount}`);
  }

  parsed.title = parsed.title.trim().slice(0, 100);
  parsed.entries = parsed.entries.map((entry, idx) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`Generated entry ${idx + 1} is not an object`);
    }
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    if (!name) throw new Error(`Generated entry ${idx + 1} missing name`);
    return {
      name: name.slice(0, 60),
      tagline: typeof entry.tagline === 'string' ? entry.tagline.trim().slice(0, 100) : ''
    };
  });

  return parsed;
}

function parseGeneratedTournament(text, expectedCount) {
  const jsonText = extractBalancedJsonObject(text);
  if (!jsonText) throw new Error('AI response did not contain a complete JSON object');
  return validateGeneratedTournament(JSON.parse(jsonText), expectedCount);
}

function normalizeGenerateCount(count) {
  const num = Number.parseInt(count, 10);
  if (![4, 8, 16, 32].includes(num)) {
    throw new Error('Count must be one of 4, 8, 16, or 32');
  }
  return num;
}

function buildGeneratePrompt(prompt, num, isRetry = false) {
  const retryLine = isRetry
    ? 'Your previous answer was not valid parseable JSON. Do not include markdown, comments, trailing commas, explanations, or extra keys. '
    : '';
  return `${retryLine}Generate a bracket tournament with exactly ${num} entries for: "${prompt}". Return ONLY a JSON object with this format, no other text: {"title":"Tournament Title","category":"food","entries":[{"name":"Entry 1","tagline":"Short tagline"},{"name":"Entry 2","tagline":"Short tagline"}]}. Category must be one of: food,travel,celebrities,athletes,movies,music,games,animals,sports,weapons,cars,anime,fashion,drinks,custom. Keep names short (under 30 chars). Keep taglines fun and under 60 chars.`;
}

async function callAnthropicGenerate(prompt, num, isRetry = false) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: buildGeneratePrompt(prompt, num, isRetry)
      }]
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Anthropic API error ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  if (data.stop_reason === 'max_tokens') {
    throw new Error('Anthropic response hit max_tokens before completing JSON');
  }
  return data.content?.[0]?.text || '';
}

app.post('/api/generate', async (req, res) => {
  try {
    const { prompt, count } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.length > 200) {
      return res.status(400).json({ error: 'Invalid prompt' });
    }
    if (!API_KEY) {
      return res.status(500).json({ error: 'Generation is not configured' });
    }

    let num;
    try {
      num = normalizeGenerateCount(count);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    let lastError;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const text = await callAnthropicGenerate(prompt, num, attempt > 0);
        return res.json(parseGeneratedTournament(text, num));
      } catch (err) {
        lastError = err;
        console.error(`Generate attempt ${attempt + 1} failed:`, err.message);
      }
    }

    return res.status(502).json({ error: 'AI response parse error', detail: lastError?.message || 'Unknown parse failure' });
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

if (require.main === module) {
  app.listen(3001, '0.0.0.0', () => console.log('API proxy on :3001'));
}

module.exports = {
  app,
  extractBalancedJsonObject,
  parseGeneratedTournament,
  validateGeneratedTournament,
  normalizeGenerateCount,
  buildGeneratePrompt
};
