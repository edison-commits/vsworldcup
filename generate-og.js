const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const TOURNAMENTS = {
  "fast-food":"Fast Food World Cup",
  "dream-vacation":"Dream Vacation World Cup",
  "best-pet":"Best Pet World Cup",
  "goat-athlete":"Greatest Athletes",
  "celeb-crush":"Celebrity Crush",
  "legendary-weapons":"Legendary Weapons",
  "dream-cars":"Dream Car World Cup",
  "best-anime":"Best Anime",
  "best-movies":"Greatest Movies",
  "cocktails":"Best Cocktail",
  "fashion-brands":"Fashion Brands World Cup",
  "sports-cup":"Sports World Cup",
  "music-artists":"Greatest Artists",
  "best-games":"Best Video Games"
};

const BUILD = path.join(__dirname, "build");
const OG_DIR = path.join(BUILD, "og");

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function makeSvg(title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a1a"/>
      <stop offset="100%" style="stop-color:#1a1a2e"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#ffd700"/>
      <stop offset="100%" style="stop-color:#ffaa00"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="4" fill="url(#gold)"/>
  <rect x="0" y="626" width="1200" height="4" fill="url(#gold)"/>
  <text x="600" y="220" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="400" letter-spacing="6" fill="#888888">VS WORLDCUP</text>
  <text x="600" y="340" text-anchor="middle" font-family="sans-serif" font-size="56" font-weight="900" fill="url(#gold)">${escapeXml(title)}</text>
  <line x1="500" y1="400" x2="700" y2="400" stroke="#ffd700" stroke-width="2" stroke-opacity="0.4"/>
  <text x="600" y="470" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#00e5ff">Pick Your Champion</text>
</svg>`;
}

if (!fs.existsSync(BUILD)) {
  console.error("Error: build/ directory not found. Run 'npm run build' first.");
  process.exit(1);
}

fs.mkdirSync(OG_DIR, { recursive: true });

let count = 0;
for (const [id, title] of Object.entries(TOURNAMENTS)) {
  const svgPath = path.join(OG_DIR, id + ".svg");
  const pngPath = path.join(OG_DIR, id + ".png");
  fs.writeFileSync(svgPath, makeSvg(title));
  try {
    execSync(`rsvg-convert -w 1200 -h 630 "${svgPath}" -o "${pngPath}"`);
    fs.unlinkSync(svgPath);
    count++;
    console.log("  " + id + ".png");
  } catch (e) {
    console.error("Failed to generate " + id + ".png:", e.message);
  }
}

console.log("\nGenerated " + count + "/" + Object.keys(TOURNAMENTS).length + " OG images in build/og/");
