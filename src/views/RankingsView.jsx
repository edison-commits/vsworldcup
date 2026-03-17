import SafeImage from "../components/SafeImage";

export default function RankingsView({ tournament, onBack, lang, T, formatNumber, getWinRate }) {
  const t = T[lang];
  const sorted = [...tournament.items].sort((a, b) => (b.wins / (b.wins + b.losses || 1)) - (a.wins / (a.wins + a.losses || 1)));
  const medals = ["🥇", "🥈", "🥉"];
  const medalColors = ["var(--gold)", "var(--silver)", "var(--bronze)"];

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "32px 24px" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--textDim)", fontFamily: "Outfit,sans-serif", fontSize: 14, cursor: "pointer", marginBottom: 20 }}>{t.back}</button>
      <h2 style={{ fontFamily: "Outfit,sans-serif", fontSize: 28, fontWeight: 800, color: "var(--text)", margin: "0 0 8px" }}>{tournament.title}</h2>
      <p style={{ fontFamily: "Outfit,sans-serif", fontSize: 14, color: "var(--textDim)", margin: "0 0 28px" }}>{t.globalRankings} {formatNumber(tournament.plays)} {t.plays}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sorted.map((item, idx) => {
          const winRate = getWinRate(item);
          return (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 14px", background: idx < 3 ? "var(--surfaceLight)" : "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <span style={{ fontFamily: "Space Mono,monospace", fontSize: idx < 3 ? 20 : 14, fontWeight: 700, width: 36, textAlign: "center", color: idx < 3 ? medalColors[idx] : "var(--textDim)" }}>{idx < 3 ? medals[idx] : `#${idx + 1}`}</span>
              <SafeImage src={item.img} fallbackSrc={item.fallbackImg} alt={item.name} loading="lazy" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", border: "2px solid var(--border)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "Outfit,sans-serif", fontSize: 15, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                <div style={{ fontFamily: "Space Mono,monospace", fontSize: 11, color: "var(--textDim)" }}>{formatNumber(item.wins)}W / {formatNumber(item.losses)}L</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "Space Mono,monospace", fontSize: 16, fontWeight: 700, color: parseFloat(winRate) >= 60 ? "var(--success)" : parseFloat(winRate) >= 50 ? "var(--accentAlt)" : "var(--accent)" }}>{winRate}%</div>
              </div>
              <div style={{ width: 70, height: 5, background: "var(--border)", borderRadius: 3, overflow: "hidden", flexShrink: 0 }}>
                <div style={{ width: `${winRate}%`, height: "100%", background: parseFloat(winRate) >= 60 ? "var(--success)" : parseFloat(winRate) >= 50 ? "var(--accentAlt)" : "var(--accent)", borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
