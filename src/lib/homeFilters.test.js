import { dedupeTournamentsForDisplay, getTournamentStats, normalizeTitleForDisplay } from './homeFilters';

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
