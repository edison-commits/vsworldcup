const rateLimits = {};

export function shuffleArray(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export function formatNumber(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toString();
}

export function getWinRate(item) {
  const total = item.wins + item.losses;
  return total > 0 ? ((item.wins / total) * 100).toFixed(1) : "0.0";
}

export function rateLimit(key, cooldownMs) {
  const now = Date.now();
  if (rateLimits[key] && now - rateLimits[key] < cooldownMs) return false;
  rateLimits[key] = now;
  return true;
}

export function isValidUrl(u) {
  if (!u || !u.trim()) return true;
  try {
    const parsed = new URL(u.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function sanitizePrompt(p) {
  return String(p || "").replace(/[<>{}`\\]/g, "").slice(0, 200).trim();
}

export function isValidAudioUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const allowed = [
      "p.scdn.co",
      "audio-ssl.itunes.apple.com",
      "cdns-preview-1.dzcdn.net",
      "cdns-preview-2.dzcdn.net",
      "cdns-preview-3.dzcdn.net",
      "cdns-preview-4.dzcdn.net",
    ];
    return u.protocol === "https:" && allowed.some((d) => u.hostname === d || u.hostname.endsWith("." + d));
  } catch {
    return false;
  }
}
