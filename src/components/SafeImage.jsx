import { useEffect, useState } from "react";

export default function SafeImage({ src, fallbackSrc, alt = "", ...props }) {
  const [currentSrc, setCurrentSrc] = useState(src || fallbackSrc || "");

  useEffect(() => {
    setCurrentSrc(src || fallbackSrc || "");
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
