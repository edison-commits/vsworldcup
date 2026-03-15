export function getDailyChallengeIndex(length, now = Date.now()) {
  if (!length || length <= 0) return 0;
  return Math.floor(now / 86400000) % length;
}

export function normalizeTournamentRecord(record, makeItemId, fallbackImage) {
  if (!record) return null;

  let items;
  try {
    items = (typeof record.items === "string" ? JSON.parse(record.items) : record.items) || [];
  } catch {
    items = [];
  }

  return {
    id: record.tournament_id || record.id,
    title: record.title,
    category: record.category || "custom",
    author: record.author || "Anonymous",
    plays: record.plays || 0,
    items: items.map((item, index) => ({
      id: makeItemId(),
      name: item.name || `Entry ${index + 1}`,
      snippet: item.snippet || "",
      snippetType: item.snippetType || "none",
      snippetSource: item.snippetSource || "",
      audioUrl: item.audioUrl || "",
      audioStartSec: item.audioStartSec || 0,
      videoId: item.videoId || "",
      videoStartSec: item.videoStartSec || 0,
      videoDuration: item.videoDuration || 8,
      img: item.img || fallbackImage(item.name || "?"),
      wins: Math.floor(Math.random() * 15000) + 3000,
      losses: Math.floor(Math.random() * 12000) + 2000,
    })),
  };
}

export function normalizeTournamentRecords(records, makeItemId, fallbackImage) {
  return (records || [])
    .filter(Boolean)
    .map((record) => normalizeTournamentRecord(record, makeItemId, fallbackImage))
    .filter((record) => record && record.items.length >= 4);
}
