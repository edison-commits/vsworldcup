import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import MediaKitView, { getInquirySource } from "./MediaKitView";

afterEach(() => {
  delete window.umami;
});

test("renders an evidence-led food relaunch kit without traction claims", () => {
  window.umami = { track: vi.fn() };
  render(<MediaKitView onBack={vi.fn()} />);

  expect(screen.getByRole("heading", { name: /turn a food debate/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /food debate week/i })).toBeInTheDocument();
  expect(screen.getByText(/traffic baseline pending dashboard readout/i)).toBeInTheDocument();
  expect(screen.getByText(/no guaranteed reach/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /play the proof bracket/i })).toHaveAttribute("href", "/t/fast-food");
  expect(window.umami.track).toHaveBeenCalledWith("media_kit_viewed", { location: "media_kit" });
});

test("preserves only the bounded home inquiry source", () => {
  expect(getInquirySource("?source=home")).toBe("home");
  expect(getInquirySource("?source=untrusted-value")).toBe("media-kit-food-wedge");
});
