function slugWords(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function clampTweet(text) {
  if (text.length <= 280) return text;
  return `${text.slice(0, 276).trim()}…`;
}

export function buildResultShareKit({ tournament = {}, winner = {}, url = 'https://vsworldcup.com' }) {
  const title = String(tournament.title || 'VS WORLDCUP').trim();
  const winnerName = String(winner.name || 'My champion').trim();
  const tagline = String(winner.tagline || '').trim();
  const headline = `${winnerName} won my ${title}`;
  const hashtags = ['#VSWORLDCUP'];
  const titleTag = slugWords(title);
  const winnerTag = slugWords(winnerName);
  if (titleTag) hashtags.push(`#${titleTag}`);
  if (winnerTag) hashtags.push(`#${winnerTag}`);
  const hashtagText = hashtags.join(' ');
  const captions = [
    clampTweet(`${headline} 🏆 ${hashtagText}`),
    clampTweet(`My bracket champion: ${winnerName}${tagline ? ` — ${tagline}` : ''}. Play yours: ${hashtagText}`),
    clampTweet(`I settled the ${title} debate. Winner: ${winnerName}.`),
  ];
  return { title, winnerName, headline, hashtags, captions, url };
}

export function getShareUrlForPlatform(platform, kit) {
  const caption = kit?.captions?.[0] || '';
  const url = kit?.url || 'https://vsworldcup.com';
  const encodedCaption = encodeURIComponent(caption);
  const encodedUrl = encodeURIComponent(url);
  if (platform === 'x') return `https://twitter.com/intent/tweet?text=${encodedCaption}&url=${encodedUrl}`;
  if (platform === 'facebook') return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedCaption}`;
  if (platform === 'whatsapp') return `https://wa.me/?text=${encodedCaption}%20${encodedUrl}`;
  if (platform === 'telegram') return `https://t.me/share/url?url=${encodedUrl}&text=${encodedCaption}`;
  if (platform === 'reddit') return `https://reddit.com/submit?url=${encodedUrl}&title=${encodedCaption}`;
  if (platform === 'clipboard') return `${caption}\n${url}`;
  return url;
}
