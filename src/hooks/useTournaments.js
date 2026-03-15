import { useEffect, useMemo, useState } from "react";
import { API_ENDPOINTS } from "../lib/api";
import { getDailyChallengeIndex, normalizeTournamentRecords } from "../lib/tournaments";

export function useTournaments(initialTournaments, makeItemId, fallbackImage) {
  const [tournaments, setTournaments] = useState(initialTournaments);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(API_ENDPOINTS.activeTournaments);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.items?.length || cancelled) return;
        const validTournaments = normalizeTournamentRecords(
          data.items,
          makeItemId,
          fallbackImage
        );
        if (!cancelled && validTournaments.length > 0) {
          setTournaments(validTournaments);
        }
      } catch (e) {
        console.log("DB load fallback to sample data:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [makeItemId, fallbackImage]);

  const dailyChallenge = useMemo(() => {
    const dayIdx = getDailyChallengeIndex(tournaments.length);
    return tournaments[dayIdx];
  }, [tournaments]);

  return { tournaments, setTournaments, dailyChallenge };
}
