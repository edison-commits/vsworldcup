#!/usr/bin/env python3
"""Auto-generate a trending tournament daily via Claude API - dedup edition"""
import json, urllib.request, datetime, random, sys, re

API_URL = "http://localhost:3001/api/collections/tournaments/records"
PROXY_URL = "http://localhost:3001/api/generate"

def log(msg):
    ts = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)

TITLE_FILLER_WORDS = {"of", "all", "time", "ever"}

def normalize_title(title):
    """Normalize tournament titles/themes for duplicate detection."""
    words = re.findall(r"[a-z0-9]+", (title or "").lower())
    while words and words[-1] in TITLE_FILLER_WORDS:
        words.pop()
    return " ".join(words)

def available_themes(themes, recent_titles):
    recent_normalized = {normalize_title(title) for title in recent_titles}
    return [theme for theme in themes if normalize_title(theme) not in recent_normalized]

def is_duplicate_title(title, recent_titles):
    return normalize_title(title) in {normalize_title(existing) for existing in recent_titles}

def fetch_json(url, timeout=10):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())

def get_recent_titles():
    """Fetch recent tournament titles to avoid duplicates"""
    try:
        url = API_URL + "?perPage=200&fields=title"
        data = fetch_json(url)
        return {r["title"] for r in data.get("items", []) if r.get("title")}
    except Exception as e:
        log(f"Warning: could not fetch recent titles: {e}")
        return set()

def generate_tournament():
    recent_titles = get_recent_titles()
    log(f"Found {len(recent_titles)} existing tournaments")
    
    today = datetime.date.today()
    day_of_week = today.strftime("%A")
    season = ("Winter" if today.month in [12,1,2] else 
              "Spring" if today.month in [3,4,5] else 
              "Summer" if today.month in [6,7,8] else "Fall")
    
    themes = [
        f"Best {season} movies of all time",
        f"Best {day_of_week} comfort foods",
        "Trending TikTok songs right now",
        "Most iconic TV show characters",
        "Best video game bosses of all time",
        "Most beautiful cities in Europe",
        "Best streaming shows right now",
        "Greatest rap albums ever",
        "Best pizza toppings",
        "Most iconic sneakers ever",
        "Best studio Ghibli films",
        "Greatest basketball players ever",
        "Best coffee drinks",
        "Most beautiful national parks",
        "Best K-pop groups of all time",
        "Greatest Marvel villains",
        "Best desserts from around the world",
        "Most overrated movies ever",
        "Best breakfast foods",
        "Greatest hip-hop albums of all time",
        "Most iconic movie villains",
        "Best summer songs",
        "Greatest TV plot twists",
        "Most beautiful beaches in the world",
        "Best fast food burgers",
        "Greatest rock bands of all time",
        "Most influential video games ever",
        "Best ice cream flavors",
        "Greatest female athletes",
        "Most iconic movie quotes",
        "Best street food around the world",
        "Greatest live performances ever",
        "Most overrated TV shows",
        "Best superhero movies ranked",
        "Greatest sports rivalries",
        "Most beautiful islands in the world",
        "Best late night snacks",
        "Greatest album covers of all time",
        "Most underrated animated movies",
        "Best tacos in different styles",
        "Greatest comeback stories in sports",
        "Most iconic fashion moments",
        "Best roller coasters in the world",
        "Greatest TV antiheroes",
        "Most beautiful castles in the world",
        "Best food cities in the world",
        "Greatest one-hit wonders",
        "Most iconic video game characters",
        "Best things to do on a rainy day",
        "Greatest sports upsets of all time",
        "Most beautiful sunsets in the world",
        "Best board games of all time",
        "Greatest movie soundtracks",
        "Most underrated restaurant cuisines",
        "Best action movies of the 2000s",
        "Greatest MLB players of all time",
        "Most iconic album covers",
        "Best things to grill at a BBQ",
        "Greatest closing songs on albums",
        "Most beautiful small towns in America",
        "Best Disney movies of all time",
        "Greatest cricket players ever",
        "Most iconic movie heroes",
        "Best foods to eat at a baseball game",
        "Greatest R&B songs of all time",
        "Most beautiful underwater places",
        "Best cereals of all time",
        "Greatest Olympians of all time",
        "Most iconic 80s movies",
        "Best sandwiches in the world",
        "Greatest goal celebrations in soccer",
        "Most beautiful train rides in the world",
        "Best pizza styles around the world",
        "Greatest goalkeepers of all time",
        "Most iconic 90s TV shows",
        "Best things about summer",
        "Greatest anime villains",
        "Most beautiful gardens in the world",
        "Best chocolate brands",
        "Greatest Formula 1 drivers",
        "Most iconic comedy movies",
        "Best ramen styles",
        "Greatest NBA dunkers of all time",
        "Most beautiful libraries in the world",
        "Best Netflix original series",
        "Greatest synth-pop songs",
        "Most iconic movie cars",
        "Best things to eat in autumn",
        "Greatest tennis rivalries",
        "Most beautiful mountain ranges",
        "Best Star Wars characters",
        "Greatest Grammy performances",
        "Most underrated video games",
        "Best candy bars",
        "Greatest MMA fighters",
        "Most beautiful train stations",
        "Best things about winter",
        "Greatest movie trilogies",
        "Most iconic fashion brands",
        "Best bubble tea flavors",
        "Greatest soccer midfielders",
    ]
    
    available = available_themes(themes, recent_titles)
    if not available:
        log("Warning: all normalized themes used, skipping generation to avoid duplicates")
        return
    
    theme = random.choice(available)
    
    prompt = f'Generate a bracket tournament with exactly 16 entries for: "{theme}"\nReturn ONLY valid JSON with no additional text or markdown.'

    try:
        log(f"Generating tournament: {theme}")
        data = json.dumps({"prompt": prompt}).encode()
        req = urllib.request.Request(PROXY_URL, data=data, headers={"Content-Type":"application/json"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            tournament = json.loads(resp.read().decode())
        
        num_entries = len(tournament.get('entries', []))
        log(f"Success: got {num_entries} entries from proxy")
        if num_entries < 16:
            raise ValueError(f"generated tournament only had {num_entries} entries")
        if is_duplicate_title(tournament.get("title", ""), recent_titles):
            log(f"Skipping duplicate generated title: {tournament.get('title')}")
            return
        
        tid = "auto-" + datetime.date.today().isoformat()
        record = {
            "tournament_id": tid,
            "title": tournament["title"],
            "category": tournament.get("category", "custom"),
            "author": "AI Generated",
            "plays": 0,
            "featured": True,
            "status": "active",
            "items": [
                {
                    "name": e["name"],
                    "snippet": e.get("tagline", ""),
                    "snippetType": "tagline",
                    "img": ""
                }
                for e in tournament.get("entries", [])[:16]
            ]
        }
        
        log("Posting to PocketBase API...")
        data = json.dumps(record).encode()
        req = urllib.request.Request(API_URL, data=data, headers={"Content-Type":"application/json"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status in (200, 201):
                log(f"SUCCESS: Created '{tournament['title']}' (ID: {tid})")
            else:
                log(f"Failed: HTTP {resp.status}")
    except Exception as e:
        log(f"Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    generate_tournament()
