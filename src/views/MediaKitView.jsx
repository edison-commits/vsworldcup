import { useEffect } from "react";
import { trackEvent } from "../lib/analytics";
import { buildSponsorMailto } from "../lib/revenueExperiments";

const proofRows = [
  ["Playable format", "Head-to-head brackets that end with one champion", "/t/fast-food"],
  ["Discovery surface", "Category, tournament, and results routes are crawlable", "/c/food"],
  ["Share loop", "Result captions plus native, X, Facebook, WhatsApp, Telegram, Reddit, and clipboard sharing", "/t/fast-food/results?winner=Pizza"],
  ["Measurement", "Existing first-party Umami host for sessions/referrers plus allowlisted play and share events", "https://analytics.vsworldcup.com"],
];

const measurementRows = [
  ["Reach", "Sessions", "Umami sessions; report actual dates and totals only after dashboard readout"],
  ["Acquisition", "Referrers", "Umami referrer report plus campaign UTMs; no PII in URLs"],
  ["Activation", "Tournament starts", "tournament_started by tournament_id, category, bracket_size"],
  ["Completion", "Finished brackets", "tournament_completed by tournament_id, category, bracket_size"],
  ["Distribution", "Result shares", "result_shared by platform, tournament_id, category"],
];

const card = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 18,
  padding: 22,
};

export function getInquirySource(search = "") {
  return new URLSearchParams(search).get("source") === "home" ? "home" : "media-kit-food-wedge";
}

export default function MediaKitView({ onBack }) {
  useEffect(() => {
    trackEvent("media_kit_viewed", { location: "media_kit" });
  }, []);

  const inquiryHref = buildSponsorMailto({
    title: "Food Debate Week partnership",
    source: getInquirySource(typeof window === "undefined" ? "" : window.location.search),
  });

  return (
    <main style={{ maxWidth: 1040, margin: "0 auto", padding: "48px 24px 72px" }}>
      <button onClick={onBack} style={{ background: "transparent", border: 0, color: "var(--accentAlt)", cursor: "pointer", fontFamily: "Outfit,sans-serif", fontWeight: 700, padding: 0, marginBottom: 24 }}>← Back to brackets</button>

      <section style={{ padding: "38px clamp(22px,5vw,52px)", borderRadius: 26, border: "1px solid rgba(255,215,0,0.28)", background: "radial-gradient(circle at top right,rgba(255,215,0,0.15),transparent 40%),linear-gradient(135deg,rgba(255,51,102,0.13),rgba(0,229,255,0.06))", marginBottom: 24 }}>
        <div style={{ fontFamily: "Space Mono,monospace", color: "var(--gold)", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Sponsor + creator media kit · baseline edition</div>
        <h1 style={{ fontFamily: "Outfit,sans-serif", fontWeight: 950, fontSize: "clamp(34px,6vw,60px)", lineHeight: 1, margin: 0, maxWidth: 780 }}>Turn a food debate into a bracket people can finish and share.</h1>
        <p style={{ fontFamily: "Outfit,sans-serif", color: "var(--textDim)", fontSize: 18, lineHeight: 1.6, maxWidth: 720, margin: "20px 0 0" }}>VS WORLDCUP is a browser-based bracket game. This kit proposes one measured relaunch wedge—not an audience-size claim.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 26 }}>
          <a href="/t/fast-food" style={{ background: "var(--gold)", color: "#111", borderRadius: 999, padding: "12px 18px", textDecoration: "none", fontFamily: "Outfit,sans-serif", fontWeight: 900 }}>Play the proof bracket</a>
          <a href={inquiryHref} onClick={() => trackEvent("sponsor_inquiry_clicked", { location: "media_kit", category: "food" })} style={{ border: "1px solid var(--border)", color: "var(--text)", borderRadius: 999, padding: "12px 18px", textDecoration: "none", fontFamily: "Outfit,sans-serif", fontWeight: 800 }}>Discuss a scoped activation</a>
        </div>
      </section>

      <section aria-labelledby="baseline-heading" style={{ ...card, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", alignItems: "baseline" }}>
          <h2 id="baseline-heading" style={{ fontFamily: "Outfit,sans-serif", fontSize: 25, margin: 0 }}>Current evidence, without inflated proof</h2>
          <span style={{ fontFamily: "Space Mono,monospace", color: "var(--accent)", fontSize: 11, textTransform: "uppercase" }}>Traffic baseline pending dashboard readout</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, marginTop: 18 }}>
          {proofRows.map(([label, description, href]) => (
            <a key={label} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined} style={{ ...card, padding: 17, textDecoration: "none" }}>
              <div style={{ color: "var(--accentAlt)", fontFamily: "Space Mono,monospace", fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>{label}</div>
              <div style={{ color: "var(--text)", fontFamily: "Outfit,sans-serif", fontSize: 14, lineHeight: 1.45, marginTop: 8 }}>{description}</div>
              <div style={{ color: "var(--textDim)", fontFamily: "Space Mono,monospace", fontSize: 10, marginTop: 10, overflowWrap: "anywhere" }}>{href}</div>
            </a>
          ))}
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18, marginBottom: 18 }}>
        <div style={card}>
          <div style={{ fontFamily: "Space Mono,monospace", color: "var(--accent)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Relaunch wedge</div>
          <h2 style={{ fontFamily: "Outfit,sans-serif", fontSize: 25, margin: "9px 0 12px" }}>Food Debate Week</h2>
          <ol style={{ color: "var(--textDim)", fontFamily: "Outfit,sans-serif", lineHeight: 1.65, paddingLeft: 20, margin: 0 }}>
            <li>Lead with the existing Fast Food World Cup.</li>
            <li>Give each creator one tagged link and a result-sharing prompt.</li>
            <li>Run for seven days only after a baseline window is captured.</li>
            <li>Compare starts, completion rate, shares per completion, and referrers.</li>
          </ol>
        </div>
        <div style={card}>
          <div style={{ fontFamily: "Space Mono,monospace", color: "var(--accentAlt)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>Activation package</div>
          <h2 style={{ fontFamily: "Outfit,sans-serif", fontSize: 25, margin: "9px 0 12px" }}>Scoped, not pre-priced</h2>
          <ul style={{ color: "var(--textDim)", fontFamily: "Outfit,sans-serif", lineHeight: 1.65, paddingLeft: 20, margin: 0 }}>
            <li>One selected or co-branded food bracket.</li>
            <li>Share-ready champion result page and captions.</li>
            <li>Campaign-tag convention and first-party readout.</li>
            <li>No guaranteed reach, outcomes, exclusivity, or scientific polling claim.</li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="measurement-heading" style={card}>
        <h2 id="measurement-heading" style={{ fontFamily: "Outfit,sans-serif", fontSize: 25, margin: "0 0 8px" }}>Baseline and campaign readout</h2>
        <p style={{ fontFamily: "Outfit,sans-serif", color: "var(--textDim)", margin: "0 0 18px", lineHeight: 1.55 }}>Use the existing Umami installation. Report a date range, observed values, and data caveats; leave every metric blank until observed. No third-party ad pixel or raw personal data is required.</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 650, fontFamily: "Outfit,sans-serif", fontSize: 14 }}>
            <thead><tr>{["Question", "Metric", "Source / rule"].map((heading) => <th key={heading} style={{ textAlign: "left", padding: "10px 12px", color: "var(--textDim)", borderBottom: "1px solid var(--border)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{heading}</th>)}</tr></thead>
            <tbody>{measurementRows.map((row) => <tr key={row[0]}>{row.map((value) => <td key={value} style={{ padding: "12px", borderBottom: "1px solid var(--border)", color: "var(--text)" }}>{value}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
