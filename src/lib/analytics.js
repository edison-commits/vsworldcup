const ALLOWED_EVENTS = new Set([
  "category_filtered",
  "media_kit_viewed",
  "result_shared",
  "sponsor_inquiry_clicked",
  "tournament_completed",
  "tournament_started",
]);

const ALLOWED_PROPERTIES = new Set([
  "bracket_size",
  "category",
  "location",
  "platform",
  "tournament_id",
]);

function sanitizeValue(value) {
  if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) {
    return value;
  }
  if (typeof value !== "string") return undefined;
  return value.replace(/[^a-zA-Z0-9 _./:-]/g, "").trim().slice(0, 80);
}

export function buildAnalyticsPayload(properties = {}) {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([key]) => ALLOWED_PROPERTIES.has(key))
      .map(([key, value]) => [key, sanitizeValue(value)])
      .filter(([, value]) => value !== undefined && value !== "")
  );
}

export function trackEvent(eventName, properties = {}) {
  if (!ALLOWED_EVENTS.has(eventName)) return false;
  if (typeof window === "undefined" || typeof window.umami?.track !== "function") return false;
  window.umami.track(eventName, buildAnalyticsPayload(properties));
  return true;
}
