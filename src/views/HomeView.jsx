import { memo, useEffect, useState } from "react";

function formatNumber(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toString();
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return d + "d ago";
  return Math.floor(d / 7) + "w ago";
}

function DailyChallengeBanner({ tournament, onPlay, lang, T }) {
  const [hours, setHours] = useState(0);
  const [mins, setMins] = useState(0);
  const t = { ...(T.en || {}), ...((T && T[lang]) || {}) };

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setUTCHours(24, 0, 0, 0);
      const diff = midnight - now;
      setHours(Math.floor(diff / 3600000));
      setMins(Math.floor((diff % 3600000) / 60000));
    };
    tick();
    const iv = setInterval(tick, 60000);
    return () => clearInterval(iv);
  }, []);

  if (!tournament) return null;
  return (
    <div
      onClick={onPlay}
      style={{
        border: "1px solid rgba(255,215,0,0.25)",
        background: "linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,102,153,0.08))",
        borderRadius: 20,
        padding: "20px 24px",
        marginBottom: 28,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 16,
        transition: "all 0.2s",
      }}
    >
      <div style={{ fontSize: 32 }}>🏆</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "Outfit,sans-serif", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "var(--gold)", marginBottom: 4 }}>
          {t.dailyChallenge}
        </div>
        <div style={{ fontFamily: "Outfit,sans-serif", fontSize: 18, fontWeight: 800, color: "var(--text)" }}>{tournament.title}</div>
        <div style={{ fontFamily: "Outfit,sans-serif", fontSize: 13, color: "var(--textDim)", marginTop: 2 }}>
          {tournament.items.length} {t.entries} · {t.sameBracket}
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontFamily: "Space Mono,monospace", fontSize: 11, color: "var(--textDim)" }}>{t.resetsIn}</div>
        <div style={{ fontFamily: "Space Mono,monospace", fontSize: 16, fontWeight: 700, color: "var(--accent)" }}>{hours}h {mins}m</div>
      </div>
    </div>
  );
}

function ResumeBanner({ resumeGame, onResumeGame, lang, T }) {
  const t = { ...(T.en || {}), ...((T && T[lang]) || {}) };
  if (!resumeGame) return null;
  return (
    <div onClick={() => onResumeGame && onResumeGame(resumeGame)} style={{ border: "1px solid rgba(0,229,255,0.22)", background: "linear-gradient(135deg, rgba(0,229,255,0.08), rgba(255,51,102,0.06))", borderRadius: 20, padding: "18px 22px", marginBottom: 20, cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ fontSize: 28 }}>🎯</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "Outfit,sans-serif", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2, color: "var(--accentAlt)", marginBottom: 4 }}>{t.continueBracket || "Continue your bracket"}</div>
        <div style={{ fontFamily: "Outfit,sans-serif", fontSize: 17, fontWeight: 800, color: "var(--text)" }}>{resumeGame.title}</div>
        <div style={{ fontFamily: "Outfit,sans-serif", fontSize: 13, color: "var(--textDim)", marginTop: 2 }}>{resumeGame.bracketSize} {t.entries} · {t.pickUpWhere || "pick up where you left off"}</div>
      </div>
      <div style={{ fontFamily: "Outfit,sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", background: "var(--accent)", borderRadius: 999, padding: "10px 14px" }}>{t.resume || "Resume"}</div>
    </div>
  );
}

function RecentlyPlayed({ recentPlays, tournaments, onSelect, lang, T }) {
  const t = { ...(T.en || {}), ...((T && T[lang]) || {}) };
  if (!recentPlays || !recentPlays.length) return null;
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontFamily: "Outfit,sans-serif", fontSize: 15, fontWeight: 700, color: "var(--textDim)", textTransform: "uppercase", letterSpacing: 2, marginBottom: 14 }}>{t.recentlyPlayed}</h3>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}>
        {recentPlays.map((play, idx) => {
          const tr = tournaments.find((t2) => t2.id === play.id);
          return (
            <div
              key={play.id + "-" + idx}
              onClick={() => tr && onSelect(tr)}
              style={{ flexShrink: 0, width: 200, background: "var(--surfaceLight)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", cursor: tr ? "pointer" : "default", opacity: tr ? 1 : 0.5, transition: "all 0.2s" }}
              onMouseEnter={(e) => {
                if (tr) {
                  e.currentTarget.style.borderColor = "var(--accent)";
                  e.currentTarget.style.boxShadow = "0 4px 20px var(--accentGlow)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ fontFamily: "Outfit,sans-serif", fontSize: 14, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{play.title}</div>
              <div style={{ fontFamily: "Outfit,sans-serif", fontSize: 13, color: "var(--gold)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 6 }}>🏆 {play.champion}</div>
              <div style={{ fontFamily: "Space Mono,monospace", fontSize: 11, color: "var(--textDim)" }}>{timeAgo(play.timestamp)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TournamentCard = memo(function TournamentCard({ tournament, onClick, lang, T, CATEGORIES }) {
  const [hover, setHover] = useState(false);
  const t = { ...(T.en || {}), ...((T && T[lang]) || {}) };
  const cat = CATEGORIES.find((c) => c.id === tournament.category);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ background: "var(--surface)", border: `1px solid ${hover ? "var(--accent)" : "var(--border)"}`, borderRadius: 16, overflow: "hidden", cursor: "pointer", transition: "all 0.3s", transform: hover ? "translateY(-4px)" : "none", boxShadow: hover ? "0 12px 40px var(--accentGlow)" : "var(--cardShadow)" }}
    >
      <div style={{ height: 170, position: "relative", overflow: "hidden", display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <img src={tournament.items[0]?.img} alt="" loading="lazy" style={{ width: "100%", height: 170, objectFit: "cover" }} />
        <img src={tournament.items[1]?.img} alt="" loading="lazy" style={{ width: "100%", height: 170, objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(10,10,15,0.95) 0%,transparent 60%)" }} />
        <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontFamily: "Outfit,sans-serif", fontWeight: 600, color: "#fff" }}>{cat?.emoji} {cat?.label[lang] || cat?.label.en}</div>
        <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontFamily: "Space Mono,monospace", color: "#00e5ff" }}>{tournament.items.length} {t.entries}</div>
      </div>
      <div style={{ padding: "14px 18px" }}>
        <h3 style={{ fontFamily: "Outfit,sans-serif", fontSize: 17, fontWeight: 700, color: "var(--text)", margin: 0, marginBottom: 6 }}>{tournament.title}</h3>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "Outfit,sans-serif", fontSize: 13, color: "var(--textDim)" }}>{t.by} {tournament.author}</span>
          <span style={{ fontFamily: "Space Mono,monospace", fontSize: 13, color: "var(--accent)" }}>▶ {formatNumber(tournament.plays)} {t.plays}</span>
        </div>
      </div>
    </div>
  );
});

export default function HomeView({ tournaments, dailyChallenge, recentPlays, resumeGame, onResumeGame, onSelect, setView, onQuickMode, onDailyChallenge, lang, sortMode, setSortMode, T, CATEGORIES }) {
  const [fc, setFc] = useState("all");
  const t = { ...(T.en || {}), ...((T && T[lang]) || {}) };
  const catFiltered = fc === "all" ? tournaments : tournaments.filter((tr) => tr.category === fc);
  const filtered = [...catFiltered].sort((a, b) => {
    if (sortMode === "new") return (b.id || "").localeCompare(a.id || "");
    if (sortMode === "az") return (a.title || "").localeCompare(b.title || "");
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return (b.plays || 0) - (a.plays || 0);
  });

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 32, padding: "36px 20px", background: "radial-gradient(ellipse at center,var(--accentGlow) 0%,transparent 70%)", borderRadius: 24 }}>
        <h1 style={{ fontFamily: "Outfit,sans-serif", fontSize: "clamp(30px,6vw,52px)", fontWeight: 900, margin: 0, lineHeight: 1.1, color: "var(--text)" }}>{t.pickYour} <span style={{ background: "linear-gradient(135deg,var(--accent),#ffaa00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", display: "inline-block", textShadow: "none" }}>{t.favorite}</span></h1>
        <p style={{ fontFamily: "Outfit,sans-serif", fontSize: 17, color: "var(--textDim)", margin: "14px auto 26px", maxWidth: 520 }}>{t.heroSub}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button onClick={() => setView("create")} style={{ background: "linear-gradient(135deg,var(--accent),#ff6699)", color: "#fff", border: "none", borderRadius: 12, padding: "14px 36px", fontSize: 16, fontWeight: 700, fontFamily: "Outfit,sans-serif", cursor: "pointer", boxShadow: "0 8px 30px var(--accentGlow)" }}>{t.createTournament}</button>
          <button onClick={onQuickMode} style={{ background: "var(--surfaceLight)", color: "var(--accentAlt)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 28px", fontSize: 16, fontWeight: 700, fontFamily: "Outfit,sans-serif", cursor: "pointer" }}>⚡ Quick Mode</button>
        </div>
      </div>

      <DailyChallengeBanner tournament={dailyChallenge} onPlay={onDailyChallenge} lang={lang} T={T} />
      <ResumeBanner resumeGame={resumeGame} onResumeGame={onResumeGame} lang={lang} T={T} />
      <RecentlyPlayed recentPlays={recentPlays} tournaments={tournaments} onSelect={onSelect} lang={lang} T={T} />

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 28, justifyContent: "center" }}>
        <button onClick={() => setFc("all")} style={{ background: fc === "all" ? "var(--accent)" : "var(--surfaceLight)", color: fc === "all" ? "#fff" : "var(--textDim)", border: `1px solid ${fc === "all" ? "var(--accent)" : "var(--border)"}`, borderRadius: 20, padding: "7px 16px", fontFamily: "Outfit,sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{t.all}</button>
        {CATEGORIES.filter((c) => c.id !== "custom").map((cat) => (
          <button key={cat.id} onClick={() => setFc(cat.id)} style={{ background: fc === cat.id ? "var(--accent)" : "var(--surfaceLight)", color: fc === cat.id ? "#fff" : "var(--textDim)", border: `1px solid ${fc === cat.id ? "var(--accent)" : "var(--border)"}`, borderRadius: 20, padding: "7px 16px", fontFamily: "Outfit,sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{cat.emoji} {cat.label[lang] || cat.label.en}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 20 }}>
        {[["popular", "🔥 Popular"], ["new", "✨ New"], ["az", "A→Z"]].map(([k, label]) => (
          <button key={k} onClick={() => setSortMode(k)} style={{ background: sortMode === k ? "var(--accent)" : "transparent", color: sortMode === k ? "#fff" : "var(--textDim)", border: `1px solid ${sortMode === k ? "var(--accent)" : "var(--border)"}`, borderRadius: 20, padding: "5px 14px", fontFamily: "Outfit,sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>{label}</button>
        ))}
      </div>

      <div className="vs-tournament-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 20 }}>
        {filtered.map((tr) => <TournamentCard key={tr.id} tournament={tr} onClick={() => onSelect(tr)} lang={lang} T={T} CATEGORIES={CATEGORIES} />)}
      </div>
      {filtered.length === 0 && <div style={{ textAlign: "center", padding: 60, color: "var(--textDim)", fontFamily: "Outfit,sans-serif", fontSize: 16 }}>{t.noCat}</div>}
    </div>
  );
}
