import { dedupeTournamentsForDisplay, getDiscoveryRows, getTournamentStats, normalizeTitleForDisplay } from './homeFilters';

test('normalizes duplicate tournament titles for display', () => {
  expect(normalizeTitleForDisplay('Best Studio Ghibli Films!')).toBe('best studio ghibli films');
  expect(normalizeTitleForDisplay('Greatest Rap Albums Ever')).toBe('greatest rap albums');
});

test('dedupes tournaments by normalized title and keeps stronger card', () => {
  const tournaments = [
    { id: 'a', title: 'Best Studio Ghibli Films', plays: 0, items: [{ img: '' }] },
    { id: 'b', title: 'best studio ghibli films!', plays: 4, items: [{ img: 'img' }] },
    { id: 'c', title: 'Best Pizza Toppings', plays: 1, items: [] },
  ];

  expect(dedupeTournamentsForDisplay(tournaments).map((t) => t.id)).toEqual(['b', 'c']);
});

test('summarizes display stats after dedupe', () => {
  const tournaments = [
    { title: 'Best Pizza Toppings', category: 'food', plays: 2 },
    { title: 'best pizza toppings', category: 'food', plays: 5 },
    { title: 'Dream Vacation Spots', category: 'travel', plays: 3 },
  ];
  const categories = [{ id: 'food' }, { id: 'travel' }, { id: 'custom' }];

  expect(getTournamentStats(tournaments, categories)).toEqual({ total: 2, categories: 2, plays: 8 });
});

test('builds discovery rows for trending, fresh, and quick-play tournaments', () => {
  const now = Date.now();
  const tournaments = [
    { id: String(now), title: 'Fresh Favorite', category: 'food', plays: 9, items: Array.from({ length: 16 }) },
    { id: 'old-popular', title: 'Old Popular', category: 'music', plays: 1200, items: Array.from({ length: 32 }) },
    { id: 'quick-8', title: 'Quick Eight', category: 'games', plays: 30, items: Array.from({ length: 8 }) },
    { id: 'tiny-4', title: 'Tiny Four', category: 'games', plays: 10, items: Array.from({ length: 4 }) },
  ];

  const rows = getDiscoveryRows(tournaments, { now });
  expect(rows.trending.map((t) => t.id)).toEqual(['old-popular', 'quick-8', 'tiny-4', String(now)]);
  expect(rows.fresh.map((t) => t.id)).toEqual([String(now)]);
  expect(rows.quick.map((t) => t.id)).toEqual(['tiny-4', 'quick-8']);
});
