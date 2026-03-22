import { StrictMode } from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OverlayPanel } from "./common";

function renderOverlayStack({
  outerOpen,
  innerOpen,
  onOuterClose = vi.fn(),
  onInnerClose = vi.fn()
}: {
  outerOpen: boolean;
  innerOpen: boolean;
  onOuterClose?: () => void;
  onInnerClose?: () => void;
}) {
  return render(
    <StrictMode>
      <>
        <OverlayPanel open={outerOpen} title="Outer" onClose={onOuterClose}>
          <div>Outer content</div>
        </OverlayPanel>
        <OverlayPanel open={innerOpen} title="Inner" onClose={onInnerClose}>
          <div>Inner content</div>
        </OverlayPanel>
      </>
    </StrictMode>
  );
}

describe("OverlayPanel", () => {
  it("keeps body scrolling locked until the last overlay closes", () => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "scroll";

    try {
      const { rerender } = renderOverlayStack({ outerOpen: true, innerOpen: false });
      expect(document.body.style.overflow).toBe("hidden");

      rerender(
        <StrictMode>
          <>
            <OverlayPanel open title="Outer" onClose={vi.fn()}>
              <div>Outer content</div>
            </OverlayPanel>
            <OverlayPanel open title="Inner" onClose={vi.fn()}>
              <div>Inner content</div>
            </OverlayPanel>
          </>
        </StrictMode>
      );
      expect(document.body.style.overflow).toBe("hidden");

      rerender(
        <StrictMode>
          <>
            <OverlayPanel open={false} title="Outer" onClose={vi.fn()}>
              <div>Outer content</div>
            </OverlayPanel>
            <OverlayPanel open title="Inner" onClose={vi.fn()}>
              <div>Inner content</div>
            </OverlayPanel>
          </>
        </StrictMode>
      );
      expect(document.body.style.overflow).toBe("hidden");

      rerender(
        <StrictMode>
          <>
            <OverlayPanel open={false} title="Outer" onClose={vi.fn()}>
              <div>Outer content</div>
            </OverlayPanel>
            <OverlayPanel open={false} title="Inner" onClose={vi.fn()}>
              <div>Inner content</div>
            </OverlayPanel>
          </>
        </StrictMode>
      );
      expect(document.body.style.overflow).toBe("scroll");
    } finally {
      document.body.style.overflow = previousOverflow;
    }
  });

  it("closes only the topmost overlay on Escape", () => {
    const onOuterClose = vi.fn();
    const onInnerClose = vi.fn();

    renderOverlayStack({
      outerOpen: true,
      innerOpen: true,
      onOuterClose,
      onInnerClose
    });

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onInnerClose).toHaveBeenCalledTimes(1);
    expect(onOuterClose).not.toHaveBeenCalled();
  });
});
