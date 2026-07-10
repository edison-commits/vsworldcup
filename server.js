const express = require("express");
const path = require("path");
const fs = require("fs");

const PORT = Number(process.env.PORT || 3000);
const BUILD = path.join(__dirname, "build");
const SITE_URL = "https://vsworldcup.com";
const SITEMAP_UPDATED = "2026-07-10";

const TOURNAMENTS = {
  "fast-food":"Fast Food World Cup","dream-vacation":"Dream Vacation World Cup",
  "best-pet":"Best Pet World Cup","goat-athlete":"Greatest Athletes",
  "celeb-crush":"Celebrity Crush","legendary-weapons":"Legendary Weapons",
  "dream-cars":"Dream Car World Cup","best-anime":"Best Anime",
  "best-movies":"Greatest Movies","cocktails":"Best Cocktail",
  "fashion-brands":"Fashion Brands World Cup","sports-cup":"Sports World Cup",
  "music-artists":"Greatest Artists","best-games":"Best Video Games"
};

const DESCRIPTIONS = {
  "fast-food":"Which fast food chain reigns supreme? Pick your champion in this bracket tournament.",
  "dream-vacation":"Beach or mountains? Pick your ultimate dream destination.",
  "best-pet":"Cats, dogs, or something wilder? Vote for the best pet.",
  "goat-athlete":"Jordan vs Messi vs Bolt — who's the greatest athlete of all time?",
  "celeb-crush":"Hollywood's finest go head to head. Who's your ultimate crush?",
  "legendary-weapons":"Excalibur vs Mjolnir — which legendary weapon wins?",
  "dream-cars":"Ferrari vs Lamborghini vs Porsche — pick your dream ride.",
  "best-anime":"Naruto vs One Piece vs Attack on Titan — crown the best anime.",
  "best-movies":"The greatest films of all time battle it out. Pick your champion.",
  "cocktails":"Margarita vs Old Fashioned — which cocktail takes the crown?",
  "fashion-brands":"Gucci vs Nike vs Chanel — which fashion brand is king?",
  "sports-cup":"Football vs basketball vs tennis — which sport is the best?",
  "music-artists":"Beatles vs Beyoncé vs Drake — who's the greatest artist?",
  "best-games":"Zelda vs GTA vs Minecraft — crown the best video game ever."
};

const CATEGORY_PAGES = {
  food: { title: "Food Bracket Tournaments - VS WORLDCUP", description: "Play food bracket tournaments and pick champions across fast food, pizza toppings, comfort foods, drinks, and more." },
  movies: { title: "Movie Bracket Tournaments - VS WORLDCUP", description: "Play movie bracket tournaments and crown winners across films, streaming shows, characters, and villains." },
  anime: { title: "Anime Bracket Tournaments - VS WORLDCUP", description: "Play anime bracket tournaments and choose champions from iconic shows, films, characters, and studios." },
  music: { title: "Music Bracket Tournaments - VS WORLDCUP", description: "Play music bracket tournaments for artists, albums, songs, K-pop groups, rap classics, and more." },
  games: { title: "Video Game Bracket Tournaments - VS WORLDCUP", description: "Play video game bracket tournaments and decide the best games, bosses, franchises, and gaming moments." },
  sports: { title: "Sports Bracket Tournaments - VS WORLDCUP", description: "Play sports bracket tournaments and crown champions across sports, athletes, teams, and fan debates." },
};

function escapeHtml(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function replaceOrInsertHead(html, pattern, replacement) {
  if (pattern.test(html)) return html.replace(pattern, replacement);
  return html.replace("</head>", `${replacement}\n</head>`);
}

function escapeXml(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
}

function buildSitemapUrls() {
  const urls = [{ loc: `${SITE_URL}/`, priority: "1.0", changefreq: "daily" }];
  Object.keys(CATEGORY_PAGES).forEach((slug) => {
    urls.push({ loc: `${SITE_URL}/c/${slug}`, priority: "0.75", changefreq: "weekly" });
  });
  Object.keys(TOURNAMENTS).forEach((id) => {
    urls.push({ loc: `${SITE_URL}/t/${encodeURIComponent(id)}`, priority: "0.85", changefreq: "weekly" });
    urls.push({ loc: `${SITE_URL}/t/${encodeURIComponent(id)}/results`, priority: "0.7", changefreq: "weekly" });
  });
  return urls;
}

function renderSitemapXml(urls = buildSitemapUrls()) {
  const entries = urls.map(({ loc, priority, changefreq }) => `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${SITEMAP_UPDATED}</lastmod>\n    <changefreq>${escapeXml(changefreq)}</changefreq>\n    <priority>${escapeXml(priority)}</priority>\n  </url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}

function renderRobotsTxt() {
  return `# https://www.robotstxt.org/robotstxt.html\nUser-agent: *\nDisallow:\nSitemap: ${SITE_URL}/sitemap.xml\n`;
}

function buildCategoryMeta(category) {
  const page = CATEGORY_PAGES[category];
  if (!page) return null;
  const url = `${SITE_URL}/c/${encodeURIComponent(category)}`;
  return { title: page.title, cardTitle: page.title.replace(" - VS WORLDCUP", ""), description: page.description, label: "PLAY BRACKETS", url, image: `${SITE_URL}/og-image.png` };
}

function buildTournamentMeta(tid, isResults) {
  const title = TOURNAMENTS[tid];
  if (!title) return null;
  const pathSuffix = `/t/${encodeURIComponent(tid)}${isResults ? "/results" : ""}`;
  const baseDescription = DESCRIPTIONS[tid] || "Two choices. One winner. Play bracket tournaments on anything.";
  const description = isResults
    ? `See the champion and play ${title} on VS WORLDCUP.`
    : baseDescription;
  return {
    title: `${title}${isResults ? " Results" : ""} - VS WORLDCUP`,
    cardTitle: title,
    description,
    label: isResults ? "RESULTS CARD" : "PLAY THE BRACKET",
    url: `${SITE_URL}${pathSuffix}`,
    image: `${SITE_URL}/og/${encodeURIComponent(tid)}.svg`,
  };
}

function renderMetaHtml(html, meta) {
  let out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(meta.title)}</title>`);
  out = replaceOrInsertHead(out, /<meta name="description" content="[^"]*"\/>/, `<meta name="description" content="${escapeHtml(meta.description)}"/>`);
  out = replaceOrInsertHead(out, /<link rel="canonical" href="[^"]*"\/>/, `<link rel="canonical" href="${escapeHtml(meta.url)}"/>`);
  out = replaceOrInsertHead(out, /<meta property="og:title" content="[^"]*"\/>/, `<meta property="og:title" content="${escapeHtml(meta.title)}"/>`);
  out = replaceOrInsertHead(out, /<meta property="og:description" content="[^"]*"\/>/, `<meta property="og:description" content="${escapeHtml(meta.description)}"/>`);
  out = replaceOrInsertHead(out, /<meta property="og:url" content="[^"]*"\/>/, `<meta property="og:url" content="${escapeHtml(meta.url)}"/>`);
  out = replaceOrInsertHead(out, /<meta property="og:image" content="[^"]*"\/>/, `<meta property="og:image" content="${escapeHtml(meta.image)}"/>`);
  out = replaceOrInsertHead(out, /<meta property="og:image:width" content="[^"]*"\/>/, `<meta property="og:image:width" content="1200"/>`);
  out = replaceOrInsertHead(out, /<meta property="og:image:height" content="[^"]*"\/>/, `<meta property="og:image:height" content="630"/>`);
  out = replaceOrInsertHead(out, /<meta property="og:image:type" content="[^"]*"\/>/, `<meta property="og:image:type" content="image/svg+xml"/>`);
  out = replaceOrInsertHead(out, /<meta name="twitter:title" content="[^"]*"\/>/, `<meta name="twitter:title" content="${escapeHtml(meta.title)}"/>`);
  out = replaceOrInsertHead(out, /<meta name="twitter:description" content="[^"]*"\/>/, `<meta name="twitter:description" content="${escapeHtml(meta.description)}"/>`);
  out = replaceOrInsertHead(out, /<meta name="twitter:image" content="[^"]*"\/>/, `<meta name="twitter:image" content="${escapeHtml(meta.image)}"/>`);
  out = replaceOrInsertHead(out, /<meta name="twitter:site" content="[^"]*"\/>/, `<meta name="twitter:site" content="@vsworldcup"/>`);
  return out;
}

function renderShareCardSvg(meta) {
  const title = escapeHtml(meta.cardTitle || meta.title);
  const description = escapeHtml(meta.description);
  const label = escapeHtml(meta.label || "VS CARD");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#111827"/><stop offset="0.55" stop-color="#581c87"/><stop offset="1" stop-color="#dc2626"/></linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#000" flood-opacity="0.35"/></filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1000" cy="95" r="170" fill="#ffffff" opacity="0.08"/>
  <circle cx="150" cy="520" r="220" fill="#ffffff" opacity="0.07"/>
  <rect x="80" y="75" width="1040" height="480" rx="42" fill="#0f172a" opacity="0.78" filter="url(#shadow)"/>
  <text x="112" y="140" fill="#facc15" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800" letter-spacing="4">VS WORLDCUP</text>
  <text x="112" y="212" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="82" font-weight="900">${title}</text>
  <text x="112" y="292" fill="#cbd5e1" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="600">${description}</text>
  <rect x="112" y="390" width="360" height="86" rx="43" fill="#ef4444"/>
  <text x="292" y="444" text-anchor="middle" fill="#fff" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="900">${label}</text>
  <text x="1088" y="505" text-anchor="end" fill="#e2e8f0" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="800">Two choices. One winner.</text>
</svg>`;
}

function createApp() {
  const app = express();
  const indexHtml = fs.readFileSync(path.join(BUILD, "index.html"), "utf8");

  function serveTournament(req, res) {
    const tid = req.params.id;
    const meta = buildTournamentMeta(tid, req.path.endsWith("/results"));
    if (!meta) {
      return res.send(indexHtml.replace(/<title>[^<]*<\/title>/, "<title>VS WORLDCUP \u2014 Pick Your Champion</title>"));
    }
    res.send(renderMetaHtml(indexHtml, meta));
  }

  app.get("/robots.txt", function(req, res) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(renderRobotsTxt());
  });

  app.get("/sitemap.xml", function(req, res) {
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(renderSitemapXml());
  });

  app.get("/og/:id.svg", function(req, res) {
    const meta = buildTournamentMeta(req.params.id, false);
    if (!meta) return res.status(404).send("Not found");
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(renderShareCardSvg(meta));
  });
  app.get("/t/:id", serveTournament);
  app.get("/t/:id/results", serveTournament);
  app.get("/c/:category", function(req, res) {
    const meta = buildCategoryMeta(req.params.category);
    if (!meta) return res.send(indexHtml);
    res.send(renderMetaHtml(indexHtml, meta));
  });
  app.get("/embed", function(req, res) { res.sendFile(path.join(BUILD, "embed.html")); });
  app.use(express.static(BUILD));
  app.use(function(req, res) { res.sendFile(path.join(BUILD, "index.html")); });
  return app;
}

if (require.main === module) {
  createApp().listen(PORT, function() { console.log("VS WORLDCUP on port " + PORT); });
}

module.exports = { buildCategoryMeta, buildSitemapUrls, buildTournamentMeta, createApp, renderMetaHtml, renderRobotsTxt, renderShareCardSvg, renderSitemapXml };
