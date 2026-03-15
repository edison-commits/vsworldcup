const express = require("express");
const path = require("path");
const fs = require("fs");
const app = express();
const PORT = 3000;
const BUILD = path.join(__dirname, "build");
const indexHtml = fs.readFileSync(path.join(BUILD, "index.html"), "utf8");

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

function escapeHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// Cache which OG images exist at startup
var ogImageSet = {};
Object.keys(TOURNAMENTS).forEach(function(tid) {
  if (fs.existsSync(path.join(BUILD, "og", tid + ".png"))) ogImageSet[tid] = true;
});

function serveTournament(req, res) {
  var tid = req.params.id;
  var title = TOURNAMENTS[tid];
  if (!title) {
    var html = indexHtml.replace(/<title>[^<]*<\/title>/, "<title>VS WORLDCUP \u2014 Pick Your Champion</title>");
    return res.send(html);
  }
  var safeTitle = escapeHtml(title);
  var desc = escapeHtml(DESCRIPTIONS[tid] || "Two choices. One winner. Play bracket tournaments on anything.");
  var url = "https://vsworldcup.com/t/" + encodeURIComponent(tid);
  var ogImage = ogImageSet[tid]
    ? "https://vsworldcup.com/og/" + encodeURIComponent(tid) + ".png"
    : "https://vsworldcup.com/og-image.png";
  var html = indexHtml
    .replace(/<title>[^<]*<\/title>/, "<title>" + safeTitle + " - VS WORLDCUP</title>")
    .replace(/<meta property="og:title" content="[^"]*"/, '<meta property="og:title" content="' + safeTitle + ' - VS WORLDCUP"')
    .replace(/<meta property="og:description" content="[^"]*"/, '<meta property="og:description" content="' + desc + '"')
    .replace(/<meta property="og:url" content="[^"]*"/, '<meta property="og:url" content="' + url + '"')
    .replace(/<meta property="og:image" content="[^"]*"/, '<meta property="og:image" content="' + ogImage + '"')
    .replace(/<meta name="twitter:title" content="[^"]*"/, '<meta name="twitter:title" content="' + safeTitle + ' - VS WORLDCUP"')
    .replace(/<meta name="twitter:description" content="[^"]*"/, '<meta name="twitter:description" content="' + desc + '"')
    .replace(/<meta name="twitter:image" content="[^"]*"/, '<meta name="twitter:image" content="' + ogImage + '"');
  res.send(html);
}

app.get("/t/:id", serveTournament);
app.get("/t/:id/results", serveTournament);
app.get("/embed", function(req, res) { res.sendFile(path.join(BUILD, "embed.html")); });
app.use(express.static(BUILD));
app.use(function(req, res) { res.sendFile(path.join(BUILD, "index.html")); });
app.listen(PORT, function() { console.log("VS WORLDCUP on port " + PORT); });
