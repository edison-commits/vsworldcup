export default function RoundSelector({ itemCount, onSelect, lang, T }) {
  const t = T[lang];
  const possible = [4, 8, 16, 32, 64, 128, 256].filter((r) => r <= itemCount);

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
      <h2 style={{ fontFamily: "Outfit,sans-serif", fontSize: 28, fontWeight: 800, color: "var(--text)", marginBottom: 12 }}>{t.chooseBracket}</h2>
      <p style={{ fontFamily: "Outfit,sans-serif", fontSize: 15, color: "var(--textDim)", marginBottom: 40 }}>{t.howMany}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
        {possible.map((r) => (
          <button
            key={r}
            onClick={() => { try { onSelect(r); } catch(e) { console.error("RoundSelector click error:", e); } }}
            style={{ width: 100, height: 100, borderRadius: 16, background: "var(--surfaceLight)", border: "2px solid var(--border)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 4, transition: "all 0.2s" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--accent)";
              e.currentTarget.style.boxShadow = "0 0 20px var(--accentGlow)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            <span style={{ fontFamily: "Space Mono,monospace", fontSize: 28, fontWeight: 700, color: "var(--accent)" }}>{r}</span>
            <span style={{ fontFamily: "Outfit,sans-serif", fontSize: 11, color: "var(--textDim)" }}>{t.roundOf} {r}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
