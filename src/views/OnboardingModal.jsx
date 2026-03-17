import { useState } from "react";

export default function OnboardingModal({ onComplete, onDismiss }) {
  const [age, setAge] = useState("");
  const [gender] = useState("");
  const [step, setStep] = useState(0);

  const ages = ["13-17", "18-24", "25-34", "35-44", "45-54", "55+"];
  const genders = [
    { id: "male", label: "♂️ Male" },
    { id: "female", label: "♀️ Female" },
    { id: "non-binary", label: "⚧ Non-binary" },
    { id: "prefer-not-to-say", label: "🤐 Skip" },
  ];

  const finish = (g) => {
    onComplete({ ageRange: age || "unknown", gender: g || gender || "unknown" });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)" }}>
      <div className="vs-modal-shell" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 24, padding: "36px 32px", maxWidth: 400, width: "90%", textAlign: "center", position: "relative" }}>
        <button onClick={onDismiss} aria-label="Close onboarding" style={{ position: "absolute", top: 14, right: 14, width: 34, height: 34, borderRadius: 17, border: "1px solid var(--border)", background: "var(--surfaceLight)", color: "var(--textDim)", fontSize: 18, cursor: "pointer" }}>×</button>
        {step === 0 && (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
            <h3 style={{ fontFamily: "Outfit,sans-serif", fontSize: 20, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>How old are you?</h3>
            <p style={{ fontFamily: "Outfit,sans-serif", fontSize: 14, color: "var(--textDim)", marginBottom: 24 }}>See how your picks compare to your age group</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginBottom: 20 }}>
              {ages.map((a) => (
                <button
                  key={a}
                  onClick={() => {
                    setAge(a);
                    setStep(1);
                  }}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 12,
                    background: age === a ? "var(--accent)" : "var(--surfaceLight)",
                    color: age === a ? "#fff" : "var(--text)",
                    border: `1px solid ${age === a ? "var(--accent)" : "var(--border)"}`,
                    fontFamily: "Space Mono,monospace",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
              <button onClick={() => { setAge("unknown"); setStep(1); }} style={{ background: "none", border: "none", color: "var(--textDim)", fontFamily: "Outfit,sans-serif", fontSize: 13, cursor: "pointer" }}>Skip →</button>
              <button onClick={onDismiss} style={{ background: "none", border: "none", color: "var(--textDim)", fontFamily: "Outfit,sans-serif", fontSize: 13, cursor: "pointer" }}>Not now</button>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>👋</div>
            <h3 style={{ fontFamily: "Outfit,sans-serif", fontSize: 20, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>How do you identify?</h3>
            <p style={{ fontFamily: "Outfit,sans-serif", fontSize: 14, color: "var(--textDim)", marginBottom: 24 }}>Compare your taste with people like you</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {genders.map((g) => (
                <button
                  key={g.id}
                  onClick={() => finish(g.id)}
                  style={{
                    padding: "12px 20px",
                    borderRadius: 12,
                    background: "var(--surfaceLight)",
                    color: "var(--text)",
                    border: "1px solid var(--border)",
                    fontFamily: "Outfit,sans-serif",
                    fontSize: 15,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <button onClick={onDismiss} style={{ background: "none", border: "none", color: "var(--textDim)", fontFamily: "Outfit,sans-serif", fontSize: 13, cursor: "pointer" }}>Not now</button>
          </>
        )}
      </div>
    </div>
  );
}
