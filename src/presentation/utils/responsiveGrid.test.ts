import { describe, expect, it } from "vitest";
import { calculateResponsiveGridLayout, RESPONSIVE_GRID_GAP_PX } from "./responsiveGrid";

describe("calculateResponsiveGridLayout", () => {
  it("keeps full rows close to the configured card width when a clean fit exists", () => {
    const layout = calculateResponsiveGridLayout({
      containerWidthPx: 1000,
      desiredCardWidthPx: 240
    });

    expect(layout.fullColumnCount).toBe(4);
    expect(layout.cardWidthPx).toBe(242.5);
    expect(layout.gapPx).toBe(RESPONSIVE_GRID_GAP_PX);
  });

  it("prefers the closest full-row layout when an exact +/-5px fit is impossible", () => {
    const layout = calculateResponsiveGridLayout({
      containerWidthPx: 1100,
      desiredCardWidthPx: 240
    });

    expect(layout.fullColumnCount).toBe(4);
    expect(layout.cardWidthPx).toBe(267.5);
  });

  it("falls back to a single card that can keep shrinking with the container", () => {
    const layout = calculateResponsiveGridLayout({
      containerWidthPx: 180,
      desiredCardWidthPx: 240
    });

    expect(layout.fullColumnCount).toBe(1);
    expect(layout.cardWidthPx).toBe(180);
  });
});
