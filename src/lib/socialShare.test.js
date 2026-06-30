import { buildResultShareKit, getShareUrlForPlatform } from './socialShare';

test('buildResultShareKit creates short captions and hashtags for a result', () => {
  const kit = buildResultShareKit({
    tournament: { id: 'fast-food', title: 'Fast Food World Cup' },
    winner: { name: 'Pizza', tagline: 'Cheesy champion' },
    url: 'https://vsworldcup.com/t/fast-food/results',
  });

  expect(kit.headline).toBe('Pizza won my Fast Food World Cup');
  expect(kit.hashtags).toEqual(['#VSWORLDCUP', '#FastFoodWorldCup', '#Pizza']);
  expect(kit.captions[0]).toContain('Pizza won my Fast Food World Cup');
  expect(kit.captions[1].length).toBeLessThanOrEqual(280);
});

test('getShareUrlForPlatform builds encoded x and copy targets', () => {
  const kit = buildResultShareKit({ tournament: { title: 'Best Snacks' }, winner: { name: 'Ramen' }, url: 'https://vsworldcup.com/t/snacks/results' });
  expect(getShareUrlForPlatform('x', kit)).toContain('twitter.com/intent/tweet');
  expect(getShareUrlForPlatform('x', kit)).toContain('Best%20Snacks');
  expect(getShareUrlForPlatform('clipboard', kit)).toBe(`${kit.captions[0]}\n${kit.url}`);
});
