function mostCommon(values, fallback) {
  const counts = new Map();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
  return sorted[0]?.[0] || fallback;
}

export function buildVotingProfile(recentPlays = []) {
  const plays = [...(recentPlays || [])].filter((play) => play && play.id);
  if (!plays.length) {
    return {
      totalPlays: 0,
      favoriteCategory: 'none yet',
      topChampion: 'none yet',
      lastPlayed: null,
      streakLabel: 'No completed brackets yet',
    };
  }
  const sorted = [...plays].sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
  return {
    totalPlays: plays.length,
    favoriteCategory: mostCommon(plays.map((play) => play.category), 'mixed'),
    topChampion: mostCommon(plays.map((play) => play.champion), 'none yet'),
    lastPlayed: sorted[0],
    streakLabel: `${plays.length} bracket${plays.length === 1 ? '' : 's'} completed`,
  };
}
