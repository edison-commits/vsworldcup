import { useState } from "react";

export default function CreateView({
  onCreated,
  lang,
  T,
  CATEGORIES,
  AiGenerator,
  isValidUrl,
  itemGradientImg,
  getNextId,
}) {
  const t = T[lang];
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("custom");
  const [items, setItems] = useState([
    { id: Date.now(), name: "", img: "" },
    { id: Date.now() + 1, name: "", img: "" },
    { id: Date.now() + 2, name: "", img: "" },
    { id: Date.now() + 3, name: "", img: "" },
  ]);
  const [error, setError] = useState("");

  const addItem = () => setItems([...items, { id: Date.now() + Math.random(), name: "", img: "" }]);
  const removeItem = (id) => {
    if (items.length <= 4) return;
    setItems(items.filter((i) => i.id !== id));
  };
  const updateItem = (id, field, value) => setItems(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  const handleAi = (res) => {
    setTitle(res.title);
    setCategory(res.category);
    setItems(res.items.map((i) => ({ id: i.id || Date.now() + Math.random(), name: i.name, img: i.img || "" })));
    setError("");
  };

  const handleSubmit = () => {
    setError("");
    const trimmedTitle = title.trim().slice(0, 100);
    if (!trimmedTitle) {
      setError(t.errTitle);
      return;
    }
    if (title.trim().length > 100) {
      setError(t.errMaxLen);
      return;
    }

    const validItems = items.filter((i) => i.name.trim());
    const count = validItems.length;
    if (count < 4) {
      setError(t.errMin);
      return;
    }
    if (!(count > 0 && (count & (count - 1)) === 0)) {
      const nextPow = Math.pow(2, Math.ceil(Math.log2(count)));
      const prevPow = Math.pow(2, Math.floor(Math.log2(count)));
      setError(t.errPow2.replace("{count}", count).replace("{add}", nextPow - count).replace("{remove}", count - prevPow));
      return;
    }

    const normalizedNames = validItems.map((i) => i.name.trim().toLowerCase());
    if (normalizedNames.length !== new Set(normalizedNames).size) {
      setError(t.errDupe);
      return;
    }

    for (let i = 0; i < validItems.length; i += 1) {
      if (validItems[i].img?.trim() && !isValidUrl(validItems[i].img)) {
        setError(t.errBadUrl.replace("{idx}", i + 1));
        return;
      }
    }

    const finalItems = validItems.map((item) => ({
      ...item,
      id: getNextId(),
      name: item.name.trim().slice(0, 60),
      img: isValidUrl(item.img) && item.img?.trim() ? item.img.trim() : itemGradientImg(item.name),
      wins: 0,
      losses: 0,
    }));

    onCreated({
      id: "custom-" + Date.now(),
      title: trimmedTitle,
      category,
      author: "You",
      plays: 0,
      items: finalItems,
    });
  };

  const validCount = items.filter((i) => i.name.trim()).length;
  const isPower = validCount > 0 && (validCount & (validCount - 1)) === 0 && validCount >= 4;
  const targets = [4, 8, 16, 32, 64].filter((n) => Math.abs(n - validCount) <= Math.max(validCount * 0.5, 4));

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "32px 24px" }}>
      <h2 style={{ fontFamily: "Outfit,sans-serif", fontSize: 30, fontWeight: 800, color: "var(--text)", marginBottom: 8 }}>{t.createTitle}</h2>
      <p style={{ fontFamily: "Outfit,sans-serif", fontSize: 15, color: "var(--textDim)", marginBottom: 28 }}>{t.createSub}</p>
      <AiGenerator onGenerated={handleAi} lang={lang} />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}><div style={{ flex: 1, height: 1, background: "var(--border)" }} /><span style={{ fontFamily: "Outfit,sans-serif", fontSize: 13, color: "var(--textDim)" }}>{t.orManual}</span><div style={{ flex: 1, height: 1, background: "var(--border)" }} /></div>
      <label style={{ fontFamily: "Outfit,sans-serif", fontSize: 14, fontWeight: 600, color: "var(--textDim)", display: "block", marginBottom: 8 }}>{t.tournamentTitle}</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.titlePlaceholder} maxLength={100} style={{ width: "100%", padding: "13px 16px", borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontFamily: "Outfit,sans-serif", fontSize: 16, outline: "none", marginBottom: 24, boxSizing: "border-box" }} />
      <label style={{ fontFamily: "Outfit,sans-serif", fontSize: 14, fontWeight: 600, color: "var(--textDim)", display: "block", marginBottom: 8 }}>{t.category}</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 28 }}>
        {CATEGORIES.map((cat) => <button key={cat.id} onClick={() => setCategory(cat.id)} style={{ background: category === cat.id ? "var(--accent)" : "var(--surfaceLight)", color: category === cat.id ? "#fff" : "var(--textDim)", border: `1px solid ${category === cat.id ? "var(--accent)" : "var(--border)"}`, borderRadius: 20, padding: "7px 14px", fontFamily: "Outfit,sans-serif", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{cat.emoji} {cat.label[lang] || cat.label.en}</button>)}
      </div>
      <label style={{ fontFamily: "Outfit,sans-serif", fontSize: 14, fontWeight: 600, color: "var(--textDim)", display: "block", marginBottom: 10 }}>{t.entriesLabel} ({items.length})</label>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "8px 14px", borderRadius: 10, background: isPower ? "rgba(0,230,118,0.08)" : "rgba(255,51,102,0.06)", border: `1px solid ${isPower ? "rgba(0,230,118,0.2)" : "rgba(255,51,102,0.15)"}`, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "Space Mono,monospace", fontSize: 13, color: isPower ? "var(--success)" : "var(--accent)" }}>{validCount} named</span>
        {!isPower && validCount >= 2 && <span style={{ fontFamily: "Outfit,sans-serif", fontSize: 12, color: "var(--textDim)" }}>→ need {targets.filter((n) => n >= 4).join(", ")}</span>}
        {isPower && <span style={{ fontSize: 14 }}>✓</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {items.map((item, idx) => (
          <div key={item.id} className="vs-entry-row">
            <span className="vs-entry-row__index" style={{ fontFamily: "Space Mono,monospace", fontSize: 12, color: "var(--textDim)", width: 26, textAlign: "right", flexShrink: 0 }}>{idx + 1}.</span>
            <input value={item.name} onChange={(e) => updateItem(item.id, "name", e.target.value)} placeholder={t.entryName} maxLength={60} style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontFamily: "Outfit,sans-serif", fontSize: 14, outline: "none", minWidth: 0 }} />
            <input value={item.img} onChange={(e) => updateItem(item.id, "img", e.target.value)} placeholder={t.imageUrl} maxLength={500} style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontFamily: "Outfit,sans-serif", fontSize: 14, outline: "none", minWidth: 0 }} />
            <button className="vs-entry-row__remove" onClick={() => removeItem(item.id)} style={{ width: 34, height: 34, borderRadius: 8, background: items.length <= 4 ? "var(--surface)" : "rgba(255,51,102,0.15)", border: `1px solid ${items.length <= 4 ? "var(--border)" : "rgba(255,51,102,0.3)"}`, color: items.length <= 4 ? "var(--border)" : "var(--accent)", fontSize: 18, cursor: items.length <= 4 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
          </div>
        ))}
      </div>
      <button onClick={addItem} style={{ background: "var(--surfaceLight)", color: "var(--accentAlt)", border: "1px dashed var(--border)", borderRadius: 12, padding: "11px 20px", fontFamily: "Outfit,sans-serif", fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%", marginBottom: 28 }}>{t.addEntry}</button>
      {error && <div style={{ background: "rgba(255,51,102,0.1)", border: "1px solid var(--accent)", borderRadius: 12, padding: "10px 16px", marginBottom: 16, fontFamily: "Outfit,sans-serif", fontSize: 14, color: "var(--accent)" }}>{error}</div>}
      <button onClick={handleSubmit} style={{ background: "linear-gradient(135deg,var(--accent),#ff6699)", color: "#fff", border: "none", borderRadius: 14, padding: "15px 40px", fontSize: 16, fontWeight: 700, fontFamily: "Outfit,sans-serif", cursor: "pointer", boxShadow: "0 8px 30px var(--accentGlow)", width: "100%" }}>{t.createAndPlay}</button>
    </div>
  );
}
