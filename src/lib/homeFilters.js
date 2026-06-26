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
