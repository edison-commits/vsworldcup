import { useEffect, useMemo, useState } from "react";

function repairWikimediaThumbUrl(url) {
  if (!url || !url.includes("upload.wikimedia.org") || !url.includes("/thumb/")) return url;
  const match = url.match(/^(https:\/\/upload\.wikimedia\.org\/.+?)\/thumb\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!match) return url;
  return `${match[1]}/${match[2]}/${match[3]}/${match[4]}`;
}

function placeholderSeed(label = "") {
  return [...label].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function PlaceholderImage({ alt = "", style = {}, className, title, ...props }) {
  const seed = placeholderSeed(alt || title || "VS");
  const hue = seed % 360;
  const initial = (alt || title || "VS").trim().charAt(0).toUpperCase() || "?";
  const { objectFit, filter, ...safeStyle } = style || {};
  const fontSize = typeof safeStyle.width === "number" && safeStyle.width <= 44 ? 13 : "clamp(22px, 10vw, 56px)";

  return (
    <div
      {...props}
      className={className}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      title={title || alt || undefined}
      style={{
        ...safeStyle,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `radial-gradient(circle at 30% 20%, hsla(${hue}, 90%, 68%, 0.55), transparent 34%), linear-gradient(135deg, hsl(${hue}, 78%, 24%), hsl(${(hue + 58) % 360}, 82%, 18%))`,
        color: "rgba(255,255,255,0.94)",
        fontFamily: "Outfit, system-ui, sans-serif",
        fontWeight: 900,
        fontSize,
        letterSpacing: 1,
        textShadow: "0 3px 14px rgba(0,0,0,0.45)",
        overflow: "hidden",
      }}
    >
      {initial}
    </div>
  );
}

export default function SafeImage({ src, fallbackSrc, alt = "", ...props }) {
  const resolvedSrc = useMemo(() => repairWikimediaThumbUrl(src) || fallbackSrc || "", [src, fallbackSrc]);
  const [currentSrc, setCurrentSrc] = useState(resolvedSrc);
  const [failed, setFailed] = useState(!resolvedSrc);

  useEffect(() => {
    const nextSrc = repairWikimediaThumbUrl(src) || fallbackSrc || "";
    setCurrentSrc(nextSrc);
    setFailed(!nextSrc);
  }, [src, fallbackSrc]);

  if (failed || !currentSrc) {
    return <PlaceholderImage alt={alt} {...props} />;
  }

  return (
    <img
      {...props}
      src={currentSrc}
      alt={alt}
      onError={() => {
        const repairedFallback = repairWikimediaThumbUrl(fallbackSrc);
        if (repairedFallback && currentSrc !== repairedFallback) {
          setCurrentSrc(repairedFallback);
        } else {
          setFailed(true);
        }
      }}
    />
  );
}
