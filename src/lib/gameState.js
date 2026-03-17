const ACTIVE_GAME_KEY = "vs_active_game";
const LAST_RESULT_KEY = "vs_last_result";
const ONBOARDING_DISMISSED_KEY = "vs_onboarding_dismissed";

export function loadActiveGame() {
  try {
    return JSON.parse(localStorage.getItem(ACTIVE_GAME_KEY) || "null");
  } catch {
    return null;
  }
}

export function saveActiveGame(payload) {
  try {
    localStorage.setItem(ACTIVE_GAME_KEY, JSON.stringify(payload));
  } catch {}
}

export function clearActiveGame() {
  try {
    localStorage.removeItem(ACTIVE_GAME_KEY);
  } catch {}
}

export function saveLastResult(payload) {
  try {
    localStorage.setItem(LAST_RESULT_KEY, JSON.stringify(payload));
  } catch {}
}

export function isOnboardingDismissed() {
  try {
    return localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissOnboarding() {
  try {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
  } catch {}
}
