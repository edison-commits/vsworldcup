import { analyzeTournamentDraft, buildEntryTextImportRows } from './creatorTools';

test('analyzeTournamentDraft reports bracket readiness and duplicate names', () => {
  const draft = analyzeTournamentDraft({
    title: '  Best Snacks  ',
    items: [
      { name: 'Pizza', img: 'https://example.com/pizza.png' },
      { name: 'pizza ', img: '' },
      { name: 'Ramen', img: 'not-a-url' },
      { name: '', img: '' },
      { name: 'Tacos', img: '' },
    ],
    isValidUrl: (url) => /^https?:\/\//.test(url),
  });

  expect(draft.validCount).toBe(4);
  expect(draft.isPowerOfTwo).toBe(true);
  expect(draft.ready).toBe(false);
  expect(draft.duplicateNames).toEqual(['pizza']);
  expect(draft.badImageRows).toEqual([3]);
  expect(draft.imageCoverage).toBe(25);
  expect(draft.checks.some((check) => check.id === 'duplicates' && check.status === 'error')).toBe(true);
});

test('buildEntryTextImportRows parses pasted newline lists into blank-image rows', () => {
  expect(buildEntryTextImportRows('Pizza\n\nRamen\nTacos')).toEqual([
    { name: 'Pizza', img: '' },
    { name: 'Ramen', img: '' },
    { name: 'Tacos', img: '' },
  ]);
});
