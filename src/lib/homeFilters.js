export function normalizeTitleForDisplay(title = "") {
  return String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(of all time|ever)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function dedupeTournamentsForDisplay(tournaments = []) {
  const byTitle = new Map();
  tournaments.forEach((tournament) => {
    const key = normalizeTitleForDisplay(tournament?.title || tournament?.id || "");
    if (!key) return;
    const existing = byTitle.get(key);
    if (!existing) {
      byTitle.set(key, tournament);
      return;
    }

    const existingPlays = existing.plays || 0;
    const nextPlays = tournament.plays || 0;
    const existingImages = (existing.items || []).filter((item) => item?.img).length;
    const nextImages = (tournament.items || []).filter((item) => item?.img).length;
    if (nextPlays > existingPlays || (nextPlays === existingPlays && nextImages > existingImages)) {
      byTitle.set(key, tournament);
    }
  });
  return [...byTitle.values()];
}

function timestampFromId(id) {
  const ts = parseInt(String(id || "").replace(/\D/g, "").slice(0, 13), 10);
  return Number.isFinite(ts) && ts > 0 ? ts : 0;
}

function isFreshTournament(tournament, now = Date.now()) {
  const ts = timestampFromId(tournament?.id);
  if (!ts) return false;
  return (now - ts) / (1000 * 60 * 60 * 24) <= 7;
}

export function getDiscoveryRows(tournaments = [], options = {}) {
  const now = options.now || Date.now();
  const deduped = dedupeTournamentsForDisplay(tournaments);
  const byPlays = [...deduped].sort((a, b) => (b.plays || 0) - (a.plays || 0));
  const fresh = deduped
    .filter((tournament) => isFreshTournament(tournament, now))
    .sort((a, b) => timestampFromId(b.id) - timestampFromId(a.id))
    .slice(0, 6);
  const quick = deduped
    .filter((tournament) => (tournament.items || []).length > 0 && (tournament.items || []).length <= 8)
    .sort((a, b) => (a.items || []).length - (b.items || []).length || (b.plays || 0) - (a.plays || 0))
    .slice(0, 6);
  return {
    trending: byPlays.slice(0, 6),
    fresh,
    quick,
  };
}

export function getTournamentStats(tournaments = [], categories = []) {
  const deduped = dedupeTournamentsForDisplay(tournaments);
  const categoryIds = new Set(deduped.map((tournament) => tournament.category).filter(Boolean));
  const categoryCount = categories.length
    ? categories.filter((category) => category.id !== "custom" && categoryIds.has(category.id)).length
    : categoryIds.size;
  return {
    total: deduped.length,
    categories: categoryCount,
    plays: deduped.reduce((sum, tournament) => sum + (tournament.plays || 0), 0),
  };
}
