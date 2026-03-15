import { useEffect, useState } from "react";

const REACTION_EMOJIS = [
  { id: "fire", emoji: "🔥", label: "Great pick" },
  { id: "trash", emoji: "🗑️", label: "Bad pick" },
  { id: "laugh", emoji: "😂", label: "Funny" },
  { id: "mindblown", emoji: "🤯", label: "Wow" },
  { id: "heart", emoji: "❤️", label: "Love it" },
  { id: "cap", emoji: "🧢", label: "Cap" },
];

function Reactions({ SFX }) {
  const [reacted, setReacted] = useState(null);
  const [counts, setCounts] = useState({ fire: 0, trash: 0, laugh: 0, mindblown: 0, heart: 0, cap: 0 });

  useEffect(() => {
    const sim = {};
    REACTION_EMOJIS.forEach((e) => {
      sim[e.id] = Math.floor(Math.random() * 200) + 10;
    });
    setCounts(sim);
  }, []);

  const react = (id) => {
    if (reacted === id) {
      setReacted(null);
      setCounts((p) => ({ ...p, [id]: p[id] - 1 }));
    } else {
      if (reacted) setCounts((p) => ({ ...p, [reacted]: p[reacted] - 1 }));
      setReacted(id);
      setCounts((p) => ({ ...p, [id]: p[id] + 1 }));
    }
    SFX.play("pick");
  };

  return (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginTop: 20 }}>
      {REACTION_EMOJIS.map((e) => (
        <button key={e.id} onClick={() => react(e.id)} title={e.label} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 20, background: reacted === e.id ? "var(--accentGlow)" : "var(--surfaceLight)", border: `1px solid ${reacted === e.id ? "var(--accent)" : "var(--border)"}`, fontSize: 16, cursor: "pointer", transition: "all 0.2s", transform: reacted === e.id ? "scale(1.1)" : "scale(1)" }}>
          <span>{e.emoji}</span>
          <span style={{ fontFamily: "Space Mono,monospace", fontSize: 11, color: "var(--textDim)" }}>{counts[e.id]}</span>
        </button>
      ))}
    </div>
  );
}

function ShareCard({ tournament, winner, history, lang, T }) {
  const t = { ...(T.en || {}), ...((T && T[lang]) || {}) };
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const shareUrl = typeof window !== "undefined" ? window.location.href : "https://vsworldcup.com";
  const shareText = `${winner.name} won ${tournament.title} on VS WORLDCUP`;
  const fullText = `${shareText}${winner.tagline ? ` — ${winner.tagline}` : ""}`;
  const encodedText = encodeURIComponent(shareText);
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedFull = encodeURIComponent(fullText);
  const hasNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  const nativeShare = async () => {
    try {
      await navigator.share({ title: `VS WORLDCUP - ${tournament.title}`, text: shareText, url: shareUrl });
      setShared(true);
      setTimeout(() => setShared(false), 3000);
    } catch (e) {}
  };

  const copyToClipboard = () => {
    navigator.clipboard?.writeText(`${fullText}\n${shareUrl}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const platforms = [
    { id: "twitter", emoji: "𝕏", label: "Twitter/X", url: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}` },
    { id: "facebook", emoji: "f", label: "Facebook", url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}` },
    { id: "whatsapp", emoji: "💬", label: "WhatsApp", url: `https://wa.me/?text=${encodedFull}%20${encodedUrl}` },
    { id: "telegram", emoji: "✈️", label: "Telegram", url: `https://t.me/share/url?url=${encodedUrl}&text=${encodedFull}` },
    { id: "reddit", emoji: "🔗", label: "Reddit", url: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedText}` },
  ];

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginTop: 24 }}>
      <h3 style={{ fontFamily: "Outfit,sans-serif", fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>{t.shareResult}</h3>
      <div style={{ background: "linear-gradient(135deg,#1a1a2e,#0a0a1a)", borderRadius: 16, padding: 24, textAlign: "center", marginBottom: 16, border: "1px solid rgba(255,215,0,0.2)" }}>
        <div style={{ fontSize: 12, fontFamily: "Space Mono,monospace", color: "#888", marginBottom: 8, letterSpacing: 2 }}>VS WORLDCUP</div>
        <div style={{ fontSize: 14, fontFamily: "Outfit,sans-serif", color: "#aaa", marginBottom: 4 }}>{tournament.title}</div>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🏆</div>
        <div style={{ fontSize: 24, fontFamily: "Outfit,sans-serif", fontWeight: 900, background: "linear-gradient(135deg,#ffd700,#ffaa00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 8 }}>{winner.name}</div>
        {winner.tagline && <div style={{ fontSize: 13, fontStyle: "italic", color: "#00e5ff", marginBottom: 12 }}>{winner.tagline}</div>}
        {history.length > 0 && <div style={{ fontSize: 11, color: "#666", fontFamily: "Space Mono,monospace" }}>{history.length} matches · {(history.reduce((a, h) => a + h.time, 0) / history.length).toFixed(1)}{t.sec} {t.avgTime}</div>}
      </div>
      {hasNativeShare ? (
        <button onClick={nativeShare} style={{ width: "100%", padding: "13px 20px", borderRadius: 12, background: shared ? "var(--success)" : "linear-gradient(135deg,var(--accent),#ff6699)", color: "#fff", border: "none", fontFamily: "Outfit,sans-serif", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>{shared ? `✓ ${t.shareNow || "Shared!"}` : `📤 ${t.shareResult || "Share Result"}`}</button>
      ) : (
        <button onClick={copyToClipboard} style={{ width: "100%", padding: "13px 20px", borderRadius: 12, background: copied ? "var(--success)" : "var(--surfaceLight)", color: copied ? "#fff" : "var(--text)", border: `1px solid ${copied ? "var(--success)" : "var(--border)"}`, fontFamily: "Outfit,sans-serif", fontSize: 15, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>{copied ? `✓ ${t.copied}` : `📋 ${t.copyResult || "Copy Result"}`}</button>
      )}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
        {platforms.map((p) => <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer" title={p.label} style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surfaceLight)", border: "1px solid var(--border)", textDecoration: "none", fontSize: p.id === "facebook" ? 18 : 16, fontWeight: p.id === "facebook" ? 800 : 400, color: p.id === "facebook" ? "#1877F2" : "var(--text)", cursor: "pointer", transition: "all 0.2s" }}>{p.emoji}</a>)}
        <button onClick={copyToClipboard} title="Copy to clipboard" style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: copied ? "var(--success)" : "var(--surfaceLight)", border: `1px solid ${copied ? "var(--success)" : "var(--border)"}`, fontSize: 16, cursor: "pointer", color: copied ? "#fff" : "var(--text)", transition: "all 0.2s" }}>{copied ? "✓" : "📋"}</button>
      </div>
    </div>
  );
}

function MatchHistory({ history, lang, T }) {
  const t = { ...(T.en || {}), ...((T && T[lang]) || {}) };
  if (!history || !history.length) return null;
  const hardest = [...history].sort((a, b) => b.time - a.time)[0];
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, marginTop: 16 }}>
      <h3 style={{ fontFamily: "Outfit,sans-serif", fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{t.matchHistory}</h3>
      {hardest && <p style={{ fontFamily: "Outfit,sans-serif", fontSize: 13, color: "var(--accentAlt)", marginBottom: 16 }}>🤔 {t.hardestChoice}: {hardest.winner.name} vs {hardest.loser.name} ({hardest.time.toFixed(1)}{t.sec})</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
        {history.map((h, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: "var(--surfaceLight)", border: "1px solid var(--border)" }}>
            <span style={{ fontFamily: "Space Mono,monospace", fontSize: 11, color: "var(--textDim)", width: 20 }}>{i + 1}</span>
            <span style={{ fontFamily: "Outfit,sans-serif", fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>{h.winner.name}</span>
            <span style={{ fontFamily: "Outfit,sans-serif", fontSize: 12, color: "var(--textDim)" }}>{t.beat}</span>
            <span style={{ fontFamily: "Outfit,sans-serif", fontSize: 14, color: "var(--textDim)" }}>{h.loser.name}</span>
            <span style={{ marginLeft: "auto", fontFamily: "Space Mono,monospace", fontSize: 11, color: h.time > 5 ? "var(--accent)" : "var(--textDim)" }}>{h.time.toFixed(1)}{t.sec}</span>
            <span style={{ fontFamily: "Space Mono,monospace", fontSize: 11, color: "var(--accentAlt)" }}>{h.spectatorPct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BracketTree({ history, lang, T, itemGradientImg }) {
  if (!history || !history.length) return null;
  const t = { ...(T.en || {}), ...((T && T[lang]) || {}) };
  const rounds = {};
  history.forEach((m) => {
    const r = m.round || 0;
    if (!rounds[r]) rounds[r] = [];
    rounds[r].push(m);
  });
  const roundKeys = Object.keys(rounds).sort((a, b) => b - a);
  const roundLabel = (r) => {
    const n = Number(r);
    if (n === 2) return t.final;
    if (n === 4) return t.semis;
    if (n === 8) return t.quarters;
    return `${t.roundOf} ${n}`;
  };
  return (
    <div style={{ marginTop: 28 }}>
      <h3 style={{ fontFamily: "Outfit,sans-serif", fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 16, textAlign: "center" }}>{t.yourBracket}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {roundKeys.map((rk) => (
          <div key={rk}>
            <div style={{ fontFamily: "Space Mono,monospace", fontSize: 11, color: "var(--accent)", marginBottom: 8, textAlign: "center" }}>{roundLabel(rk)}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
              {rounds[rk].map((m, i) => (
                <div key={i} style={{ background: "var(--surfaceLight)", border: "1px solid var(--border)", borderRadius: 12, padding: "8px 12px", minWidth: 140, display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <img src={m.winner?.img || itemGradientImg(m.winner?.name)} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} />
                    <span style={{ fontFamily: "Outfit,sans-serif", fontSize: 13, fontWeight: 700, color: "var(--success)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.winner?.name}</span>
                    <span style={{ fontSize: 10 }}>✓</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.5 }}>
                    <img src={m.loser?.img || itemGradientImg(m.loser?.name)} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} />
                    <span style={{ fontFamily: "Outfit,sans-serif", fontSize: 13, fontWeight: 600, color: "var(--textDim)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.loser?.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WinnerScreen({ tournament, winner, history, demographics, onPlayAgain, onRematch, onViewRanking, onBack, lang, T, SFX, itemGradientImg }) {
  const t = { ...(T.en || {}), ...((T && T[lang]) || {}) };
  useEffect(() => {
    SFX.play("victory");
  }, [SFX]);

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 24px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
        <h2 style={{ fontFamily: "Outfit,sans-serif", fontSize: 16, fontWeight: 600, color: "var(--textDim)", margin: 0, textTransform: "uppercase", letterSpacing: 3 }}>{tournament.title}</h2>
        <h1 style={{ fontFamily: "Outfit,sans-serif", fontSize: "clamp(28px,6vw,44px)", fontWeight: 900, margin: "12px 0 24px", background: "linear-gradient(135deg,var(--gold),#ffaa00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{winner.name}</h1>
        <div style={{ width: 220, height: 280, borderRadius: 20, overflow: "hidden", margin: "0 auto 20px", border: "3px solid var(--gold)", boxShadow: "0 0 60px rgba(255,215,0,0.3)" }}>
          <img src={winner.img} alt={winner.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        {winner.tagline && <p style={{ fontFamily: "Outfit,sans-serif", fontSize: 15, color: "var(--accentAlt)", fontStyle: "italic", marginBottom: 12 }}>{winner.tagline}</p>}
        <p style={{ fontFamily: "Outfit,sans-serif", fontSize: 16, color: "var(--textDim)", marginBottom: 8 }}>{t.yourChampion}</p>
        {demographics?.ageRange && demographics.ageRange !== "unknown" && (
          <div style={{ display: "inline-flex", gap: 8, padding: "6px 14px", borderRadius: 20, background: "var(--surfaceLight)", border: "1px solid var(--border)", marginBottom: 16 }}>
            {demographics.ageRange !== "unknown" && <span style={{ fontFamily: "Space Mono,monospace", fontSize: 11, color: "var(--accentAlt)" }}>📊 {demographics.ageRange}</span>}
            {demographics.gender && demographics.gender !== "unknown" && demographics.gender !== "prefer-not-to-say" && <span style={{ fontFamily: "Space Mono,monospace", fontSize: 11, color: "var(--textDim)" }}>· {demographics.gender}</span>}
            {demographics.region && <span style={{ fontFamily: "Space Mono,monospace", fontSize: 11, color: "var(--textDim)" }}>· 📍 {demographics.region}</span>}
          </div>
        )}
        <Reactions SFX={SFX} />
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 20 }}>
          <button onClick={onPlayAgain} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 12, padding: "11px 20px", fontSize: 14, fontWeight: 700, fontFamily: "Outfit,sans-serif", cursor: "pointer" }}>{t.playAgain}</button>
          <button onClick={onRematch} style={{ background: "var(--surfaceLight)", color: "var(--accentAlt)", border: "1px solid var(--border)", borderRadius: 12, padding: "11px 20px", fontSize: 14, fontWeight: 700, fontFamily: "Outfit,sans-serif", cursor: "pointer" }}>{t.rematch}</button>
          <button onClick={onViewRanking} style={{ background: "var(--surfaceLight)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 12, padding: "11px 20px", fontSize: 14, fontWeight: 700, fontFamily: "Outfit,sans-serif", cursor: "pointer" }}>{t.viewRankings}</button>
          <button onClick={onBack} style={{ background: "transparent", color: "var(--textDim)", border: "1px solid var(--border)", borderRadius: 12, padding: "11px 20px", fontSize: 14, fontWeight: 700, fontFamily: "Outfit,sans-serif", cursor: "pointer" }}>{t.browseMore}</button>
        </div>
      </div>
      <ShareCard tournament={tournament} winner={winner} history={history} lang={lang} T={T} />
      <BracketTree history={history} lang={lang} T={T} itemGradientImg={itemGradientImg} />
      <MatchHistory history={history} lang={lang} T={T} />
    </div>
  );
}
