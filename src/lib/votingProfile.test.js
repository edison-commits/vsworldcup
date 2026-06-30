import { buildVotingProfile } from './votingProfile';

test('buildVotingProfile summarizes recent champions and categories', () => {
  const profile = buildVotingProfile([
    { id: 'fast-food', title: 'Fast Food', champion: 'Pizza', category: 'food', timestamp: 10 },
    { id: 'movies', title: 'Movies', champion: 'Alien', category: 'movies', timestamp: 20 },
    { id: 'snacks', title: 'Snacks', champion: 'Pizza', category: 'food', timestamp: 30 },
  ]);

  expect(profile.totalPlays).toBe(3);
  expect(profile.favoriteCategory).toBe('food');
  expect(profile.topChampion).toBe('Pizza');
  expect(profile.lastPlayed.title).toBe('Snacks');
  expect(profile.streakLabel).toBe('3 brackets completed');
});

test('buildVotingProfile handles an empty history', () => {
  expect(buildVotingProfile([])).toEqual({
    totalPlays: 0,
    favoriteCategory: 'none yet',
    topChampion: 'none yet',
    lastPlayed: null,
    streakLabel: 'No completed brackets yet',
  });
});
