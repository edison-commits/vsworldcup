const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({ origin: ['https://vsworldcup.com', 'https://www.vsworldcup.com'] }));
app.use(express.json());

const API_KEY = process.env.ANTHROPIC_API_KEY;
const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
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
  const num = typeof count === 'number'
    ? count
    : (typeof count === 'string' && count.trim() !== '' ? Number(count.trim()) : Number.NaN);
  if (!Number.isInteger(num)) {
    throw new Error('Count must be one of 4, 8, 16, or 32');
  }
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

function buildAnthropicGenerateRequest(prompt, num, isRetry = false) {
  return {
    model: process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: buildGeneratePrompt(prompt, num, isRetry)
    }]
  };
}

async function callAnthropicGenerate(prompt, num, isRetry = false) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(buildAnthropicGenerateRequest(prompt, num, isRetry))
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
    let num;
    try {
      num = normalizeGenerateCount(count);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid count', detail: err.message });
    }
    if (!API_KEY) {
      return res.status(500).json({ error: 'Generation is not configured' });
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

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'vsworldcup-api', timestamp: new Date().toISOString() }));

function buildPocketBaseUrl(collection, id, query) {
  const params = new URLSearchParams(query);
  const baseUrl = id
    ? `http://localhost:8090/api/collections/${collection}/records/${id}`
    : `http://localhost:8090/api/collections/${collection}/records`;
  return params.size > 0 ? `${baseUrl}?${params}` : baseUrl;
}

function buildPocketBaseProxyOptions(req) {
  return {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {})
    },
    ...(['POST', 'PATCH', 'PUT'].includes(req.method) ? { body: JSON.stringify(req.body) } : {})
  };
}

async function proxyPocketBaseRequest(req, res, id) {
  const { collection } = req.params;
  const pbUrl = buildPocketBaseUrl(collection, id, req.query);
  const pbRes = await fetch(pbUrl, buildPocketBaseProxyOptions(req));
  const text = await pbRes.text();
  res.status(pbRes.status).type('application/json').send(text);
}

// Collection-level proxy (GET, POST)
app.all('/api/collections/:collection/records', async (req, res) => {
  try {
    await proxyPocketBaseRequest(req, res);
  } catch (err) {
    console.error('Collection proxy error:', err.message);
    res.status(500).json({ error: 'Proxy error' });
  }
});

// Single-record proxy (GET, PATCH, PUT, DELETE)
app.all('/api/collections/:collection/records/:id', async (req, res) => {
  try {
    await proxyPocketBaseRequest(req, res, req.params.id);
  } catch (err) {
    console.error('Record proxy error:', err.message);
    res.status(500).json({ error: 'Proxy error' });
  }
});

// POST /api/plays/increment — atomically increment plays count in PocketBase
app.post('/api/plays/increment', async (req, res) => {
  try {
    const { tournament_id } = req.body;
    if (!tournament_id || typeof tournament_id !== 'string') {
      return res.status(400).json({ error: 'tournament_id required' });
    }

    const getRes = await fetch(
      `http://localhost:8090/api/collections/tournaments/records/${tournament_id}?fields=plays`
    );
    if (!getRes.ok) {
      const err = await getRes.text();
      console.error('Plays increment GET error:', err);
      return res.status(getRes.status).json({ error: 'Failed to read plays' });
    }

    const data = await getRes.json();
    const currentPlays = typeof data.plays === 'number' ? data.plays : 0;
    const updateRes = await fetch(
      `http://localhost:8090/api/collections/tournaments/records/${tournament_id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.PB_ADMIN_TOKEN ? { Authorization: `Bearer ${process.env.PB_ADMIN_TOKEN}` } : {})
        },
        body: JSON.stringify({ plays: currentPlays + 1 })
      }
    );
    if (!updateRes.ok) {
      const err = await updateRes.text();
      console.error('Plays increment PATCH error:', err);
      return res.status(updateRes.status).json({ error: 'Failed to update plays' });
    }

    const updated = await updateRes.json();
    res.json({ ok: true, plays: updated.plays });
  } catch (err) {
    console.error('Plays increment error:', err.message);
    res.status(500).json({ error: err.message });
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
  buildGeneratePrompt,
  buildAnthropicGenerateRequest
};
