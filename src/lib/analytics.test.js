import { afterEach, describe, expect, test, vi } from "vitest";
import { buildAnalyticsPayload, trackEvent } from "./analytics";

afterEach(() => {
  delete window.umami;
});

describe("privacy-safe analytics", () => {
  test("keeps only allowlisted, bounded non-PII properties", () => {
    expect(buildAnalyticsPayload({
      tournament_id: "fast-food<script>",
      category: "food",
      bracket_size: 16,
      email: "person@example.com",
      note: "private",
    })).toEqual({
      tournament_id: "fast-foodscript",
      category: "food",
      bracket_size: 16,
    });
  });

  test("sends allowlisted events through the existing Umami client", () => {
    window.umami = { track: vi.fn() };

    expect(trackEvent("tournament_started", {
      tournament_id: "fast-food",
      category: "food",
      bracket_size: 16,
    })).toBe(true);
    expect(window.umami.track).toHaveBeenCalledWith("tournament_started", {
      tournament_id: "fast-food",
      category: "food",
      bracket_size: 16,
    });
  });

  test("fails closed for unknown events or an unavailable client", () => {
    window.umami = { track: vi.fn() };
    expect(trackEvent("user_profile_exported", { category: "food" })).toBe(false);
    expect(window.umami.track).not.toHaveBeenCalled();

    delete window.umami;
    expect(trackEvent("tournament_started", { category: "food" })).toBe(false);
  });
});
