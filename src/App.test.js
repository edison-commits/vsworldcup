import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import App from "./App";
import { getDailyChallengeIndex, normalizeTournamentRecords } from "./lib/tournaments";

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ items: [] }),
    })
  );

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  window.history.replaceState(null, "", "/");
  window.localStorage.clear();
});

afterEach(() => {
  vi.resetAllMocks();
});

test("renders VS WORLDCUP home screen", async () => {
  render(<App />);

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalled();
  });

  expect(screen.getByText(/Pick Your/i)).toBeInTheDocument();
  expect(screen.getByText(/Create Tournament/i)).toBeInTheDocument();
});

test("getDailyChallengeIndex safely handles empty lists", () => {
  expect(getDailyChallengeIndex(0, 0)).toBe(0);
});

test("normalizeTournamentRecords filters invalid tournaments", () => {
  const records = [
    { id: "ok", title: "Okay", items: [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }] },
    { id: "bad", title: "Bad", items: [{ name: "A" }] },
  ];

  const nextId = (() => {
    let id = 1;
    return () => id++;
  })();

  const normalized = normalizeTournamentRecords(records, nextId, () => "img");

  expect(normalized).toHaveLength(1);
  expect(normalized[0].id).toBe("ok");
  expect(normalized[0].items).toHaveLength(4);
});
