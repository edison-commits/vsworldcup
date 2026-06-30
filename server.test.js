const assert = require('node:assert/strict');
const test = require('node:test');
const {
  buildTournamentMeta,
  renderMetaHtml,
  renderShareCardSvg,
} = require('./server');

test('buildTournamentMeta produces route-specific canonical share metadata', () => {
  const playMeta = buildTournamentMeta('fast-food', false);
  assert.equal(playMeta.title, 'Fast Food World Cup - VS WORLDCUP');
  assert.equal(playMeta.url, 'https://vsworldcup.com/t/fast-food');
  assert.equal(playMeta.image, 'https://vsworldcup.com/og/fast-food.svg');
  assert.match(playMeta.description, /fast food chain reigns supreme/i);

  const resultMeta = buildTournamentMeta('fast-food', true);
  assert.equal(resultMeta.title, 'Fast Food World Cup Results - VS WORLDCUP');
  assert.equal(resultMeta.url, 'https://vsworldcup.com/t/fast-food/results');
  assert.match(resultMeta.description, /See the champion/i);
});

test('renderMetaHtml injects canonical url, image dimensions, and twitter labels', () => {
  const html = renderMetaHtml('<html><head><title>Old</title><meta name="description" content="Old"/><meta property="og:type" content="website"/><meta property="og:title" content="Old"/><meta property="og:description" content="Old"/><meta property="og:url" content="Old"/><meta property="og:site_name" content="Old"/><meta property="og:image" content="Old"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="Old"/><meta name="twitter:description" content="Old"/><meta name="twitter:image" content="Old"/></head><body></body></html>', buildTournamentMeta('fast-food', true));

  assert.match(html, /<link rel="canonical" href="https:\/\/vsworldcup.com\/t\/fast-food\/results"\/>/);
  assert.match(html, /property="og:image:width" content="1200"/);
  assert.match(html, /property="og:image:height" content="630"/);
  assert.match(html, /name="twitter:site" content="@vsworldcup"/);
  assert.match(html, /Fast Food World Cup Results - VS WORLDCUP/);
});

test('renderShareCardSvg escapes tournament copy and includes brand composition', () => {
  const svg = renderShareCardSvg({
    title: 'Fast <Food> & Friends',
    description: 'Pizza "wins" & burgers try again',
    label: 'RESULTS CARD',
  });
  assert.match(svg, /^<svg/);
  assert.match(svg, /VS WORLDCUP/);
  assert.match(svg, /Fast &lt;Food&gt; &amp; Friends/);
  assert.match(svg, /Pizza &quot;wins&quot; &amp; burgers try again/);
  assert.doesNotMatch(svg, /<Food>/);
});
