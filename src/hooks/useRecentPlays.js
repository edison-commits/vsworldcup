import { useState } from "react";
import { loadJson, saveJson, STORAGE_KEYS } from "../lib/storage";

export function useRecentPlays() {
  const [recentPlays, setRecentPlays] = useState(() =>
    loadJson(STORAGE_KEYS.recentPlays, [])
  );

  const addRecentPlay = (play) => {
    setRecentPlays((prev) => {
      const updated = [play, ...prev.filter((item) => item.id !== play.id)].slice(0, 10);
      saveJson(STORAGE_KEYS.recentPlays, updated);
      return updated;
    });
  };

  return { recentPlays, addRecentPlay };
}
