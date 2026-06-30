import { useEffect, useState } from "react";
import SafeImage from "../components/SafeImage";
import { API_ENDPOINTS } from "../lib/api";

function CountryWinnersMap({ tournament }) {
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    if (!tournament?.id || typeof API_ENDPOINTS.countryWinners !== "function") {
      setStatus("empty");
      return () => { cancelled = true; };
    }
    setStatus("loading");
    fetch(API_ENDPOINTS.countryWinners(tournament.id))
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`stats ${res.status}`))))
      .then((data) => {
        if (cancelled) return;
        const countries = Array.isArray(data.countries) ? data.countries.filter((c) => c.country_code !== "XX") : [];
        setStats({ ...data, countries });
        setStatus(countries.length ? "ready" : "empty");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => { cancelled = true; };
  }, [tournament?.id]);

  const countries = stats?.countries || [];
  const regions = stats?.regions || [];
  const globalTopItems = stats?.global_top_items || [];
  const topCountries = countries.slice(0, 12);

  return (
    <section style={{ margin: "30px 0 28px", background: "linear-gradient(135deg,rgba(0,229,255,0.08),rgba(255,51,102,0.08))", border: "1px solid var(--border)", borderRadius: 20, padding: 20, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
        <div>
          <h3 style={{ fontFamily: "Outfit,sans-serif", fontSize: 20, fontWeight: 900, color: "var(--text)", margin: "0 0 4px" }}>🌍 World #1 Map</h3>
          <p style={{ fontFamily: "Outfit,sans-serif", fontSize: 13, color: "var(--textDim)", margin: 0 }}>See which item is #1 in each country based on completed brackets.</p>
        </div>
        {stats?.sample_size ? <span style={{ fontFamily: "Space Mono,monospace", fontSize: 11, color: "var(--accentAlt)", padding: "6px 10px", borderRadius: 999, background: "var(--surfaceLight)", border: "1px solid var(--border)", whiteSpace: "nowrap" }}>{stats.sample_size} results</span> : null}
      </div>

      <div style={{ position: "relative", minHeight: 150, borderRadius: 18, background: "radial-gradient(circle at 20% 35%, rgba(0,229,255,0.28), transparent 24%), radial-gradient(circle at 48% 42%, rgba(255,215,0,0.22), transparent 21%), radial-gradient(circle at 78% 38%, rgba(255,51,102,0.26), transparent 24%), radial-gradient(circle at 58% 72%, rgba(0,255,136,0.18), transparent 18%), linear-gradient(135deg,#07111f,#130a1f)", border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 16 }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.22, backgroundImage: "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 8, padding: 18, alignContent: "flex-start" }}>
          {status === "loading" && <div style={{ fontFamily: "Outfit,sans-serif", color: "var(--textDim)", fontSize: 14 }}>Loading country winners…</div>}
          {status === "error" && <div style={{ fontFamily: "Outfit,sans-serif", color: "var(--textDim)", fontSize: 14 }}>Country map is temporarily unavailable.</div>}
          {status === "empty" && <div style={{ fontFamily: "Outfit,sans-serif", color: "var(--textDim)", fontSize: 14 }}>Not enough country data yet. It will fill in as people finish brackets.</div>}
          {status === "ready" && topCountries.map((country) => (
            <div key={country.country_code} title={`${country.country}: ${country.top_item}`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 999, background: "rgba(0,0,0,0.48)", border: "1px solid rgba(255,255,255,0.14)", backdropFilter: "blur(8px)", maxWidth: "100%" }}>
              <span style={{ fontSize: 17 }}>{country.flag}</span>
              <span style={{ fontFamily: "Space Mono,monospace", fontSize: 11, color: "var(--accentAlt)", fontWeight: 800 }}>{country.country_code}</span>
              <span style={{ fontFamily: "Outfit,sans-serif", fontSize: 12, color: "#fff", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{country.top_item}</span>
            </div>
          ))}
        </div>
      </div>

      {countries.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 8 }}>
          {countries.slice(0, 8).map((country) => (
            <div key={`row-${country.country_code}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}>
              <span style={{ fontSize: 22 }}>{country.flag}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "Outfit,sans-serif", fontSize: 13, fontWeight: 800, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{country.country}</div>
                <div style={{ fontFamily: "Space Mono,monospace", fontSize: 11, color: "var(--accent)" }}>#1 {country.top_item}</div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "Space Mono,monospace", fontSize: 12, color: "var(--success)", fontWeight: 800 }}>{country.share}%</div>
                <div style={{ fontFamily: "Space Mono,monospace", fontSize: 10, color: "var(--textDim)" }}>{country.wins}/{country.total_sessions}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(regions.length > 0 || globalTopItems.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 10, marginTop: 14 }}>
          {regions.slice(0, 4).map((region) => (
            <div key={`region-${region.region}`} style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,0.035)", border: "1px solid var(--border)" }}>
              <div style={{ fontFamily: "Outfit,sans-serif", fontSize: 12, fontWeight: 900, color: "var(--textDim)", textTransform: "uppercase", letterSpacing: 1 }}>{region.region}</div>
              <div style={{ fontFamily: "Outfit,sans-serif", fontSize: 16, fontWeight: 900, color: "var(--text)", marginTop: 4 }}>{region.top_item}</div>
              <div style={{ fontFamily: "Space Mono,monospace", fontSize: 11, color: "var(--accentAlt)", marginTop: 5 }}>{region.share}% · {region.total_sessions} results · {region.country_count} countries</div>
            </div>
          ))}
          {globalTopItems.slice(0, 3).map((item, idx) => (
            <div key={`global-${item.name}`} style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(255,215,0,0.055)", border: "1px solid rgba(255,215,0,0.16)" }}>
              <div style={{ fontFamily: "Outfit,sans-serif", fontSize: 12, fontWeight: 900, color: "var(--gold)", textTransform: "uppercase", letterSpacing: 1 }}>Global #{idx + 1}</div>
              <div style={{ fontFamily: "Outfit,sans-serif", fontSize: 16, fontWeight: 900, color: "var(--text)", marginTop: 4 }}>{item.name}</div>
              <div style={{ fontFamily: "Space Mono,monospace", fontSize: 11, color: "var(--textDim)", marginTop: 5 }}>{item.count} wins across countries</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

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
      <CountryWinnersMap tournament={tournament} />
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
