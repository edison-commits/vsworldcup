const test = require('node:test');
const assert = require('node:assert/strict');
const {
  app,
  extractBalancedJsonObject,
  parseGeneratedTournament,
  validateGeneratedTournament,
  normalizeGenerateCount,
  buildGeneratePrompt
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
