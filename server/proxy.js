const express = require('express');
const cors = require('cors');
const childProcess = require('child_process');
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

const COUNTRY_NAME_OVERRIDES = {
  US: 'United States', GB: 'United Kingdom', KR: 'South Korea', JP: 'Japan', CN: 'China',
  BR: 'Brazil', VN: 'Vietnam', TH: 'Thailand', DE: 'Germany', FR: 'France', ES: 'Spain',
  MX: 'Mexico', CA: 'Canada', AU: 'Australia', IN: 'India', ID: 'Indonesia', PH: 'Philippines'
};

function normalizeCountryCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) && code !== 'XX' ? code : '';
}

function countryNameFromCode(code) {
  const normalized = normalizeCountryCode(code);
  if (!normalized) return 'Unknown';
  if (COUNTRY_NAME_OVERRIDES[normalized]) return COUNTRY_NAME_OVERRIDES[normalized];
  try {
    if (typeof Intl !== 'undefined' && Intl.DisplayNames) {
      return new Intl.DisplayNames(['en'], { type: 'region' }).of(normalized) || normalized;
    }
  } catch (err) {
    // Fall through to the region code when Intl.DisplayNames is unavailable.
  }
  return normalized;
}

function countryFlagEmoji(code) {
  const normalized = normalizeCountryCode(code);
  if (!normalized) return '🌐';
  return normalized.replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function inferCountryCode(record = {}) {
  const direct = normalizeCountryCode(record.country_code || record.countryCode || record.country);
  if (direct) return direct;
  const locale = String(record.locale || '').trim();
  const localeRegion = locale.match(/[-_]([A-Za-z]{2})(?:\b|$)/)?.[1];
  if (localeRegion) return normalizeCountryCode(localeRegion);
  const timezone = String(record.timezone || '').trim();
  const timezoneCountryByName = {
    'America/New_York': 'US',
    'America/Chicago': 'US',
    'America/Denver': 'US',
    'America/Phoenix': 'US',
    'America/Los_Angeles': 'US',
    'America/Anchorage': 'US',
    'Pacific/Honolulu': 'US',
    'America/Toronto': 'CA',
    'America/Vancouver': 'CA',
    'America/Montreal': 'CA',
    'America/Mexico_City': 'MX',
    'America/Sao_Paulo': 'BR'
  };
  if (timezoneCountryByName[timezone]) return timezoneCountryByName[timezone];
  const timezoneHints = [
    [/^Europe\/London$/, 'GB'], [/^Europe\/Paris$/, 'FR'], [/^Europe\/Berlin$/, 'DE'],
    [/^Asia\/Seoul$/, 'KR'], [/^Asia\/Tokyo$/, 'JP'], [/^Asia\/Shanghai$/, 'CN'], [/^Asia\/Bangkok$/, 'TH'],
    [/^Asia\/Ho_Chi_Minh$/, 'VN'], [/^Australia\//, 'AU']
  ];
  return timezoneHints.find(([pattern]) => pattern.test(timezone))?.[1] || '';
}

const REGION_BY_COUNTRY = {
  US: 'North America', CA: 'North America', MX: 'North America',
  BR: 'South America', AR: 'South America', CL: 'South America', CO: 'South America', PE: 'South America',
  GB: 'Europe', FR: 'Europe', DE: 'Europe', ES: 'Europe', IT: 'Europe', NL: 'Europe', SE: 'Europe', NO: 'Europe', DK: 'Europe', IE: 'Europe',
  JP: 'Asia', KR: 'Asia', CN: 'Asia', IN: 'Asia', ID: 'Asia', PH: 'Asia', VN: 'Asia', TH: 'Asia', SG: 'Asia', MY: 'Asia',
  AU: 'Oceania', NZ: 'Oceania',
  ZA: 'Africa', NG: 'Africa', KE: 'Africa', EG: 'Africa', MA: 'Africa'
};

function regionFromCountryCode(code) {
  const normalized = normalizeCountryCode(code);
  return normalized ? (REGION_BY_COUNTRY[normalized] || 'Other') : 'Unknown';
}

function summarizeChampionCounts(records = []) {
  const counts = new Map();
  for (const record of records || []) {
    const champion = String(record?.champion_name || '').trim();
    if (!champion) continue;
    counts.set(champion, (counts.get(champion) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
}

function buildCountryWinnerStats(records = []) {
  const byCountry = new Map();
  for (const record of records || []) {
    const champion = String(record?.champion_name || '').trim();
    if (!champion) continue;
    const code = inferCountryCode(record) || 'XX';
    if (!byCountry.has(code)) {
      byCountry.set(code, {
        country_code: code,
        country: code === 'XX' ? 'Unknown' : countryNameFromCode(code),
        flag: countryFlagEmoji(code),
        total_sessions: 0,
        champions: new Map()
      });
    }
    const bucket = byCountry.get(code);
    bucket.total_sessions += 1;
    bucket.champions.set(champion, (bucket.champions.get(champion) || 0) + 1);
  }
  return [...byCountry.values()].map((bucket) => {
    const championCounts = [...bucket.champions.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const [top_item, wins] = championCounts[0] || ['Unknown', 0];
    return {
      country_code: bucket.country_code,
      country: bucket.country,
      region: regionFromCountryCode(bucket.country_code),
      flag: bucket.flag,
      top_item,
      wins,
      total_sessions: bucket.total_sessions,
      share: bucket.total_sessions ? Math.round((wins / bucket.total_sessions) * 100) : 0,
      contenders: championCounts.slice(0, 5).map(([name, count]) => ({ name, count }))
    };
  }).sort((a, b) => b.total_sessions - a.total_sessions || a.country.localeCompare(b.country));
}

async function fetchPocketBasePlaySessions(tournamentId, maxRecords = 1000) {
  const token = process.env.PB_ADMIN_TOKEN;
  const perPage = 200;
  const records = [];
  for (let page = 1; records.length < maxRecords; page += 1) {
    const params = new URLSearchParams({
      page: String(page),
      perPage: String(Math.min(perPage, maxRecords - records.length)),
      sort: '-created',
      filter: `tournament_id="${String(tournamentId).replace(/"/g, '\\"')}"`
    });
    const pbRes = await fetch(`http://localhost:8090/api/collections/play_sessions/records?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!pbRes.ok) {
      const detail = await pbRes.text();
      const err = new Error(`PocketBase play_sessions read failed: ${pbRes.status}`);
      err.status = pbRes.status;
      err.detail = detail.slice(0, 500);
      throw err;
    }
    const data = await pbRes.json();
    records.push(...(data.items || []));
    if (page >= (data.totalPages || 1) || !(data.items || []).length) break;
  }
  return records;
}

function fetchSqlitePlaySessions(tournamentId, maxRecords = 1000) {
  const dbPath = process.env.PB_SQLITE_PATH || '/opt/pocketbase/pb_data/data.db';
  const script = `
import json, sqlite3, sys
path, tournament_id, limit = sys.argv[1], sys.argv[2], int(sys.argv[3])
con = sqlite3.connect(path)
con.row_factory = sqlite3.Row
rows = con.execute('''
  SELECT champion_name, locale, screen_size, user_agent
  FROM play_sessions
  WHERE tournament_id = ? AND champion_name <> ''
  ORDER BY rowid DESC
  LIMIT ?
''', (tournament_id, limit)).fetchall()
print(json.dumps([dict(row) for row in rows]))
`;
  const out = childProcess.execFileSync('python3', ['-c', script, dbPath, String(tournamentId), String(maxRecords)], {
    encoding: 'utf8',
    timeout: 5000,
    maxBuffer: 1024 * 1024
  });
  return JSON.parse(out);
}

async function fetchPlaySessionsForStats(tournamentId, maxRecords = 1000) {
  try {
    return await fetchPocketBasePlaySessions(tournamentId, maxRecords);
  } catch (err) {
    if (err.status !== 403) throw err;
    console.warn('PocketBase API stats read failed, falling back to sqlite:', err.message);
    return fetchSqlitePlaySessions(tournamentId, maxRecords);
  }
}

function buildRegionalWinnerStats(records = []) {
  const byRegion = new Map();
  for (const record of records || []) {
    const champion = String(record?.champion_name || '').trim();
    if (!champion) continue;
    const countryCode = inferCountryCode(record) || 'XX';
    const region = regionFromCountryCode(countryCode);
    if (!byRegion.has(region)) byRegion.set(region, { region, total_sessions: 0, champions: new Map(), countries: new Set() });
    const bucket = byRegion.get(region);
    bucket.total_sessions += 1;
    bucket.countries.add(countryCode);
    bucket.champions.set(champion, (bucket.champions.get(champion) || 0) + 1);
  }
  return [...byRegion.values()].map((bucket) => {
    const championCounts = [...bucket.champions.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const [top_item, wins] = championCounts[0] || ['Unknown', 0];
    return {
      region: bucket.region,
      top_item,
      wins,
      total_sessions: bucket.total_sessions,
      country_count: [...bucket.countries].filter((code) => code !== 'XX').length,
      share: bucket.total_sessions ? Math.round((wins / bucket.total_sessions) * 100) : 0,
      contenders: championCounts.slice(0, 5).map(([name, count]) => ({ name, count }))
    };
  }).sort((a, b) => b.total_sessions - a.total_sessions || a.region.localeCompare(b.region));
}

app.get('/api/stats/tournaments/:tournamentId/country-winners', async (req, res) => {
  try {
    const { tournamentId } = req.params;
    if (!tournamentId || tournamentId.length > 100) return res.status(400).json({ error: 'Invalid tournamentId' });
    const limit = Math.min(Math.max(Number(req.query.limit) || 1000, 1), 2000);
    const records = await fetchPlaySessionsForStats(tournamentId, limit);
    res.json({
      tournament_id: tournamentId,
      countries: buildCountryWinnerStats(records),
      regions: buildRegionalWinnerStats(records),
      global_top_items: summarizeChampionCounts(records).slice(0, 10),
      sample_size: records.length
    });
  } catch (err) {
    console.error('Country winners stats error:', err.message, err.detail || '');
    res.status(502).json({ error: 'Failed to build country winner stats' });
  }
});

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
  buildAnthropicGenerateRequest,
  normalizeCountryCode,
  inferCountryCode,
  regionFromCountryCode,
  summarizeChampionCounts,
  fetchSqlitePlaySessions,
  buildCountryWinnerStats,
  buildRegionalWinnerStats
};
