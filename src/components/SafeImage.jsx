import { useEffect, useState } from "react";

function repairWikimediaThumbUrl(url) {
  if (!url || !url.includes("upload.wikimedia.org") || !url.includes("/thumb/")) return url;
  const match = url.match(/^(https:\/\/upload\.wikimedia\.org\/.+?)\/thumb\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!match) return url;
  return `${match[1]}/${match[2]}/${match[3]}/${match[4]}`;
}

export default function SafeImage({ src, fallbackSrc, alt = "", ...props }) {
  const resolvedSrc = repairWikimediaThumbUrl(src) || fallbackSrc || "";
  const [currentSrc, setCurrentSrc] = useState(resolvedSrc);

  useEffect(() => {
    setCurrentSrc(repairWikimediaThumbUrl(src) || fallbackSrc || "");
  }, [src, fallbackSrc]);

  return (
    <img
      {...props}
      src={currentSrc}
      alt={alt}
      onError={() => {
        if (fallbackSrc && currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
        }
      }}
    />
  );
}
