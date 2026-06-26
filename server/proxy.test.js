const test = require('node:test');
const assert = require('node:assert/strict');
const {
  app,
  extractBalancedJsonObject,
  parseGeneratedTournament,
  validateGeneratedTournament,
  normalizeGenerateCount,
  buildGeneratePrompt,
  inferCountryCode,
  buildCountryWinnerStats
} = require('./proxy');

test('extractBalancedJsonObject ignores prose and braces inside strings', () => {
  const text = 'Here you go {"title":"Best { Weird } Snacks","category":"food","entries":[{"name":"A","tagline":"uses } safely"}]} trailing text {bad';
  assert.equal(
    extractBalancedJsonObject(text),
    '{"title":"Best { Weird } Snacks","category":"food","entries":[{"name":"A","tagline":"uses } safely"}]}'
  );
});

test('parseGeneratedTournament accepts fenced JSON and normalizes category fallback', () => {
  const parsed = parseGeneratedTournament('```json\n{"title":" Test ","category":"unknown","entries":[{"name":" Alpha ","tagline":" One "},{"name":"Beta"}]}\n```', 2);
  assert.equal(parsed.title, 'Test');
  assert.equal(parsed.category, 'custom');
  assert.deepEqual(parsed.entries, [
    { name: 'Alpha', tagline: 'One' },
    { name: 'Beta', tagline: '' }
  ]);
});

test('parseGeneratedTournament rejects incomplete/truncated JSON', () => {
  assert.throws(
    () => parseGeneratedTournament('{"title":"Broken","category":"food","entries":[{"name":"A"}', 1),
    /complete JSON object/
  );
});

test('validateGeneratedTournament rejects wrong entry counts', () => {
  assert.throws(
    () => validateGeneratedTournament({ title: 'Too short', category: 'food', entries: [{ name: 'A' }] }, 2),
    /expected 2/
  );
});

test('normalizeGenerateCount only accepts bracket-safe powers of two', () => {
  assert.equal(normalizeGenerateCount('4'), 4);
  assert.equal(normalizeGenerateCount(' 8 '), 8);
  assert.equal(normalizeGenerateCount(16), 16);
  assert.throws(() => normalizeGenerateCount('4abc'), /4, 8, 16, or 32/);
  assert.throws(() => normalizeGenerateCount(''), /4, 8, 16, or 32/);
  assert.throws(() => normalizeGenerateCount(8.5), /4, 8, 16, or 32/);
  assert.throws(() => normalizeGenerateCount(6), /4, 8, 16, or 32/);
  assert.throws(() => normalizeGenerateCount(64), /4, 8, 16, or 32/);
});

test('buildGeneratePrompt adds stricter retry instructions', () => {
  const first = buildGeneratePrompt('best pizza toppings', 16, false);
  const retry = buildGeneratePrompt('best pizza toppings', 16, true);
  assert.match(first, /exactly 16 entries/);
  assert.match(retry, /previous answer was not valid parseable JSON/);
  assert.match(retry, /Return ONLY a JSON object/);
});

test('generate route rejects invalid counts before API configuration or provider calls', async () => {
  const previousApiKey = process.env.ANTHROPIC_API_KEY;
  const previousFetch = global.fetch;
  delete process.env.ANTHROPIC_API_KEY;
  let providerCalled = false;
  global.fetch = async () => {
    providerCalled = true;
    throw new Error('provider should not be called for invalid count');
  };

  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await previousFetch(`http://127.0.0.1:${port}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'best ramen', count: '4abc' })
    });
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.error, 'Invalid count');
    assert.equal(providerCalled, false);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    global.fetch = previousFetch;
    if (previousApiKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = previousApiKey;
    }
  }
});

test('buildAnthropicGenerateRequest uses production-proven model fallback and token budget', () => {
  const { buildAnthropicGenerateRequest } = require('./proxy');
  const previousModel = process.env.ANTHROPIC_MODEL;
  delete process.env.ANTHROPIC_MODEL;
  try {
    const fallbackBody = buildAnthropicGenerateRequest('best ramen', 8, false);
    assert.equal(fallbackBody.model, 'claude-haiku-4-5-20251001');
    assert.equal(fallbackBody.max_tokens, 4096);
    assert.match(fallbackBody.messages[0].content, /exactly 8 entries/);

    process.env.ANTHROPIC_MODEL = 'claude-test-model';
    const overrideBody = buildAnthropicGenerateRequest('best ramen', 8, true);
    assert.equal(overrideBody.model, 'claude-test-model');
    assert.match(overrideBody.messages[0].content, /previous answer was not valid parseable JSON/);
  } finally {
    if (previousModel === undefined) {
      delete process.env.ANTHROPIC_MODEL;
    } else {
      process.env.ANTHROPIC_MODEL = previousModel;
    }
  }
});

test('health route exposes production-compatible service metadata', async () => {
  const previousFetch = global.fetch;
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await previousFetch(`http://127.0.0.1:${port}/health`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'vsworldcup-api');
    assert.match(body.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
});

test('single-record proxy forwards method, auth header, body, and query string', async () => {
  const previousFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ id: 'abc123', ok: true }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await previousFetch(`http://127.0.0.1:${port}/api/collections/tournaments/records/abc123?expand=entries`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer user-token'
      },
      body: JSON.stringify({ title: 'Updated' })
    });
    const body = await response.json();
    assert.equal(response.status, 202);
    assert.deepEqual(body, { id: 'abc123', ok: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'http://localhost:8090/api/collections/tournaments/records/abc123?expand=entries');
    assert.equal(calls[0].options.method, 'PATCH');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer user-token');
    assert.equal(calls[0].options.body, JSON.stringify({ title: 'Updated' }));
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    global.fetch = previousFetch;
  }
});

test('plays increment reads current count and patches increment with admin token when available', async () => {
  const previousFetch = global.fetch;
  const previousToken = process.env.PB_ADMIN_TOKEN;
  const calls = [];
  process.env.PB_ADMIN_TOKEN = 'pb-test-token';
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    if (String(url).endsWith('?fields=plays')) {
      return new Response(JSON.stringify({ plays: 41 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ plays: 42 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await previousFetch(`http://127.0.0.1:${port}/api/plays/increment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournament_id: 'tour123' })
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true, plays: 42 });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].url, 'http://localhost:8090/api/collections/tournaments/records/tour123?fields=plays');
    assert.equal(calls[1].url, 'http://localhost:8090/api/collections/tournaments/records/tour123');
    assert.equal(calls[1].options.method, 'PATCH');
    assert.equal(calls[1].options.headers.Authorization, 'Bearer pb-test-token');
    assert.equal(calls[1].options.body, JSON.stringify({ plays: 42 }));
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    global.fetch = previousFetch;
    if (previousToken === undefined) {
      delete process.env.PB_ADMIN_TOKEN;
    } else {
      process.env.PB_ADMIN_TOKEN = previousToken;
    }
  }
});


test('inferCountryCode uses direct country fields and locale fallbacks', () => {
  assert.equal(inferCountryCode({ country_code: 'kr' }), 'KR');
  assert.equal(inferCountryCode({ locale: 'en-US' }), 'US');
  assert.equal(inferCountryCode({ locale: 'ko_KR' }), 'KR');
  assert.equal(inferCountryCode({ timezone: 'Asia/Tokyo' }), 'JP');
  assert.equal(inferCountryCode({ timezone: 'America/Los_Angeles' }), 'US');
  assert.equal(inferCountryCode({ timezone: 'America/Toronto' }), 'CA');
  assert.equal(inferCountryCode({ timezone: 'America/Mexico_City' }), 'MX');
  assert.equal(inferCountryCode({ timezone: 'America/Sao_Paulo' }), 'BR');
  assert.equal(inferCountryCode({ timezone: 'America/Argentina/Buenos_Aires' }), '');
  assert.equal(inferCountryCode({ locale: 'en' }), '');
});

test('buildCountryWinnerStats returns the #1 champion per country', () => {
  const stats = buildCountryWinnerStats([
    { locale: 'en-US', champion_name: 'Pizza' },
    { locale: 'en-US', champion_name: 'Pizza' },
    { locale: 'en-US', champion_name: 'Tacos' },
    { locale: 'ko-KR', champion_name: 'Ramen' },
    { locale: 'ko-KR', champion_name: 'Ramen' },
    { locale: 'ko-KR', champion_name: 'Pizza' }
  ]);
  const us = stats.find((country) => country.country_code === 'US');
  const kr = stats.find((country) => country.country_code === 'KR');
  assert.equal(us.top_item, 'Pizza');
  assert.equal(us.wins, 2);
  assert.equal(us.total_sessions, 3);
  assert.equal(us.share, 67);
  assert.equal(kr.top_item, 'Ramen');
});

test('country winners route reads play sessions and returns country stats', async () => {
  const previousFetch = global.fetch;
  const previousToken = process.env.PB_ADMIN_TOKEN;
  const calls = [];
  process.env.PB_ADMIN_TOKEN = 'pb-country-token';
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({
      page: 1,
      totalPages: 1,
      items: [
        { locale: 'en-US', champion_name: 'Pizza' },
        { locale: 'en-US', champion_name: 'Pizza' },
        { locale: 'en-US', champion_name: 'Tacos' },
        { locale: 'ko-KR', champion_name: 'Ramen' }
      ]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await previousFetch(`http://127.0.0.1:${port}/api/stats/tournaments/tour123/country-winners?limit=50`);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.tournament_id, 'tour123');
    assert.equal(body.sample_size, 4);
    assert.equal(body.countries[0].country_code, 'US');
    assert.equal(body.countries[0].top_item, 'Pizza');
    assert.equal(body.countries[0].share, 67);
    assert.equal(calls.length, 1);
    assert.match(String(calls[0].url), /play_sessions\/records\?/);
    assert.match(String(calls[0].url), /perPage=50/);
    assert.match(String(calls[0].url), /tournament_id/);
    assert.equal(calls[0].options.headers.Authorization, 'Bearer pb-country-token');
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    global.fetch = previousFetch;
    if (previousToken === undefined) {
      delete process.env.PB_ADMIN_TOKEN;
    } else {
      process.env.PB_ADMIN_TOKEN = previousToken;
    }
  }
});
