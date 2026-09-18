import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

describe("analytics bootstrap", () => {
  test("loads the tracker from the exact live Umami URL", () => {
    const html = readFileSync("index.html", "utf8");
    const document = new DOMParser().parseFromString(html, "text/html");
    const tracker = document.querySelector('script[data-website-id="703d4b6d-649e-466e-a63d-ef1366e80b0f"]');

    expect(tracker?.getAttribute("src")).toBe("https://analytics.vsworldcup.com/script.js");
  });
});
