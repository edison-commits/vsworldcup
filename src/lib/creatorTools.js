export function buildEntryTextImportRows(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((name) => ({ name: name.slice(0, 60), img: '' }));
}

function normalizeName(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isPowerOfTwo(count) {
  return count > 0 && (count & (count - 1)) === 0;
}

export function analyzeTournamentDraft({ title = '', items = [], isValidUrl = () => false }) {
  const trimmedTitle = String(title || '').trim();
  const namedItems = (items || []).filter((item) => String(item?.name || '').trim());
  const validCount = namedItems.length;
  const normalizedNames = namedItems.map((item) => normalizeName(item.name));
  const counts = normalizedNames.reduce((acc, name) => acc.set(name, (acc.get(name) || 0) + 1), new Map());
  const duplicateNames = [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name);
  const badImageRows = [];
  let imageCount = 0;
  namedItems.forEach((item, idx) => {
    const img = String(item?.img || '').trim();
    if (!img) return;
    if (isValidUrl(img)) imageCount += 1;
    else badImageRows.push(idx + 1);
  });
  const power = isPowerOfTwo(validCount) && validCount >= 4;
  const nextPower = validCount > 0 ? Math.pow(2, Math.ceil(Math.log2(Math.max(validCount, 4)))) : 4;
  const previousPower = validCount > 0 ? Math.pow(2, Math.floor(Math.log2(validCount))) : 0;
  const checks = [
    { id: 'title', label: 'Title', status: trimmedTitle ? 'ok' : 'error', detail: trimmedTitle ? `${trimmedTitle.length}/100 characters` : 'Add a title' },
    { id: 'entries', label: 'Bracket size', status: power ? 'ok' : 'warning', detail: power ? `${validCount} entries is playable` : `Use 4, 8, 16, 32, or 64 entries` },
    { id: 'duplicates', label: 'Duplicates', status: duplicateNames.length ? 'error' : 'ok', detail: duplicateNames.length ? duplicateNames.join(', ') : 'No duplicate names' },
    { id: 'images', label: 'Images', status: badImageRows.length ? 'error' : 'ok', detail: badImageRows.length ? `Bad image URLs on rows ${badImageRows.join(', ')}` : `${imageCount}/${validCount} image URLs` },
  ];
  return {
    title: trimmedTitle,
    validCount,
    isPowerOfTwo: power,
    ready: Boolean(trimmedTitle && power && duplicateNames.length === 0 && badImageRows.length === 0),
    duplicateNames,
    badImageRows,
    imageCoverage: validCount ? Math.round((imageCount / validCount) * 100) : 0,
    nextPower,
    previousPower,
    checks,
  };
}
