import { useEffect, useRef, useState } from "react";
import SafeImage from "../components/SafeImage";

export function QuickMode({ tournaments, onFinish, SFX, shuffleArray, lang = "en", T = {} }) {
  const [picks, setPicks] = useState([]);
  const [matchups, setMatchups] = useState([]);
  const [ci, setCi] = useState(0);
  const [selected, setSelected] = useState(null);
  const [animating, setAnimating] = useState(false);
  const animRef = useRef(false);
  const timerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const allItems = tournaments.flatMap((tr) => tr.items);
    const shuffled = shuffleArray(allItems);
    const pairs = [];
    for (let i = 0; i < 10 && i < shuffled.length; i += 2) pairs.push([shuffled[i], shuffled[i + 1]]);
    setMatchups(pairs.slice(0, 5));
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [tournaments, shuffleArray]);

  const handlePick = (item, other) => {
    if (animRef.current) return;
    animRef.current = true;
    setAnimating(true);
    setSelected(item.id);
    SFX.play("pick");
    timerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      const newPicks = [...picks, { winner: item, loser: other }];
      if (ci + 1 < matchups.length) {
        setPicks(newPicks);
        setCi((p) => p + 1);
      } else {
        SFX.play("victory");
        onFinish(newPicks);
        return;
      }
      setSelected(null);
      setAnimating(false);
      animRef.current = false;
    }, 400);
  };

  const t = { ...(T.en || {}), ...((T && T[lang]) || {}) };
  if (!matchups.length || !matchups[ci]) return null;
  const [left, right] = matchups[ci];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontFamily: "Outfit,sans-serif", fontSize: 12, fontWeight: 700, color: "var(--accentAlt)", textTransform: "uppercase", letterSpacing: 3, marginBottom: 8 }}>{`⚡ ${t.quickMode || "Quick Mode"}`}</div>
        <div style={{ fontFamily: "Space Mono,monospace", fontSize: 14, color: "var(--accent)" }}>{ci + 1} / {matchups.length}</div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 12 }}>
          {matchups.map((_, i) => (
            <div key={i} style={{ width: 40, height: 4, borderRadius: 2, background: i < ci ? "var(--accent)" : i === ci ? "var(--accentAlt)" : "var(--border)", transition: "background 0.3s" }} />
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, position: "relative" }}>
        {[left, right].map((item, si) => {
          const isSel = selected === item.id;
          const isLos = selected && !isSel;
          const other = si === 0 ? right : left;
          return (
            <div
              key={`q${si}-${ci}`}
              onClick={() => handlePick(item, other)}
              style={{ position: "relative", borderRadius: 20, overflow: "hidden", cursor: animating ? "default" : "pointer", pointerEvents: animating ? "none" : "auto", border: `2px solid ${isSel ? "var(--accent)" : "var(--border)"}`, transition: "all 0.3s", transform: isSel ? "scale(1.02)" : isLos ? "scale(0.95)" : "scale(1)", opacity: isLos ? 0.4 : 1 }}
            >
              <SafeImage src={item.img} fallbackSrc={item.fallbackImg} alt={item.name} style={{ width: "100%", height: "100%", minHeight: 280, objectFit: "cover", display: "block" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(0,0,0,0.85) 0%,transparent 60%)" }} />
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 18px" }}>
                <h3 style={{ fontFamily: "Outfit,sans-serif", fontSize: "clamp(14px, 3.5vw, 20px)", fontWeight: 800, color: "#fff", margin: 0 }}>{item.name}</h3>
              </div>
              {isSel && <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 42, animation: "pop 0.3s ease", color: "#fff" }}>✓</div>}
            </div>
          );
        })}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 10, pointerEvents: "none" }}>
          <span style={{ display: "inline-block", width: 44, height: 44, lineHeight: "44px", borderRadius: "50%", background: "var(--bg)", border: "2px solid var(--accent)", fontFamily: "Space Mono,monospace", fontSize: 14, fontWeight: 700, color: "var(--accent)", textAlign: "center" }}>VS</span>
        </div>
      </div>
    </div>
  );
}

export function QuickResults({ picks, onPlayAgain, onGoHome, lang = "en", T = {} }) {
  const t = { ...(T.en || {}), ...((T && T[lang]) || {}) };
  return (
    <div style={{ maxWidth: 500, margin: "0 auto", padding: "40px 24px", textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
      <h2 style={{ fontFamily: "Outfit,sans-serif", fontSize: 24, fontWeight: 800, color: "var(--text)", marginBottom: 24 }}>{t.quickPicks || "Your Quick Picks"}</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 28 }}>
        {picks.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 12, background: "var(--surfaceLight)", border: "1px solid var(--border)" }}>
            <SafeImage src={p.winner.img} fallbackSrc={p.winner.fallbackImg} alt="" loading="lazy" style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover" }} />
            <span style={{ fontFamily: "Outfit,sans-serif", fontSize: 15, fontWeight: 700, color: "var(--accent)" }}>{p.winner.name}</span>
            <span style={{ fontFamily: "Outfit,sans-serif", fontSize: 12, color: "var(--textDim)" }}>over</span>
            <span style={{ fontFamily: "Outfit,sans-serif", fontSize: 14, color: "var(--textDim)" }}>{p.loser.name}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button onClick={onPlayAgain} style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 12, padding: "11px 20px", fontSize: 14, fontWeight: 700, fontFamily: "Outfit,sans-serif", cursor: "pointer" }}>{`⚡ ${t.quickAgain || "Again"}`}</button>
        <button onClick={onGoHome} style={{ background: "var(--surfaceLight)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 12, padding: "11px 20px", fontSize: 14, fontWeight: 700, fontFamily: "Outfit,sans-serif", cursor: "pointer" }}>{t.browseAll || "Browse All"}</button>
      </div>
    </div>
  );
}
