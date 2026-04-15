import { useEffect, useMemo, useState } from "react";

export const RESPONSIVE_GRID_GAP_PX = 10;
export const RESPONSIVE_GRID_WIDTH_TOLERANCE_PX = 5;
export const PAGE_CARD_TARGET_WIDTH_PX = 280;

interface ResponsiveGridCandidate {
  columnCount: number;
  cardWidthPx: number;
  deltaPx: number;
  withinTolerance: boolean;
}

export interface ResponsiveGridLayout {
  fullColumnCount: number;
  cardWidthPx: number;
  gapPx: number;
}

export function useResponsiveGridLayout(
  containerElement: HTMLElement | null,
  desiredCardWidthPx: number,
  gapPx = RESPONSIVE_GRID_GAP_PX,
  widthTolerancePx = RESPONSIVE_GRID_WIDTH_TOLERANCE_PX
) {
  const [containerWidthPx, setContainerWidthPx] = useState(0);

  useEffect(() => {
    if (!containerElement) {
      setContainerWidthPx(0);
      return;
    }

    function updateWidth(nextWidthPx: number) {
      const roundedWidthPx = Number(nextWidthPx.toFixed(2));
      setContainerWidthPx((currentWidthPx) =>
        Math.abs(currentWidthPx - roundedWidthPx) < 0.5 ? currentWidthPx : roundedWidthPx
      );
    }

    updateWidth(containerElement.getBoundingClientRect().width);

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const nextWidthPx = entries[0]?.contentRect.width ?? containerElement.getBoundingClientRect().width;
      updateWidth(nextWidthPx);
    });

    observer.observe(containerElement);

    return () => observer.disconnect();
  }, [containerElement]);

  return useMemo(
    () =>
      calculateResponsiveGridLayout({
        containerWidthPx,
        desiredCardWidthPx,
        gapPx,
        widthTolerancePx
      }),
    [containerWidthPx, desiredCardWidthPx, gapPx, widthTolerancePx]
  );
}

export function calculateResponsiveGridLayout({
  containerWidthPx,
  desiredCardWidthPx,
  gapPx = RESPONSIVE_GRID_GAP_PX,
  widthTolerancePx = RESPONSIVE_GRID_WIDTH_TOLERANCE_PX
}: {
  containerWidthPx: number;
  desiredCardWidthPx: number;
  gapPx?: number;
  widthTolerancePx?: number;
}): ResponsiveGridLayout {
  const safeDesiredCardWidthPx = Math.max(1, desiredCardWidthPx);
  const safeGapPx = Math.max(0, gapPx);
  const safeTolerancePx = Math.max(0, widthTolerancePx);
  const safeContainerWidthPx = Math.max(0, containerWidthPx);

  if (safeContainerWidthPx === 0) {
    return {
      fullColumnCount: 1,
      cardWidthPx: safeDesiredCardWidthPx,
      gapPx: safeGapPx
    };
  }

  const minimumProbeCardWidthPx = Math.max(1, safeDesiredCardWidthPx - safeTolerancePx);
  const maxColumnCount = Math.max(
    1,
    Math.floor((safeContainerWidthPx + safeGapPx) / (minimumProbeCardWidthPx + safeGapPx))
  );

  let bestCandidate: ResponsiveGridCandidate | null = null;

  for (let columnCount = 1; columnCount <= maxColumnCount; columnCount += 1) {
    const cardWidthPx = (safeContainerWidthPx - safeGapPx * (columnCount - 1)) / columnCount;
    if (cardWidthPx <= 0) {
      continue;
    }

    const deltaPx = Math.abs(cardWidthPx - safeDesiredCardWidthPx);
    const candidate: ResponsiveGridCandidate = {
      columnCount,
      cardWidthPx,
      deltaPx,
      withinTolerance: deltaPx <= safeTolerancePx
    };

    if (isBetterGridCandidate(candidate, bestCandidate, safeDesiredCardWidthPx)) {
      bestCandidate = candidate;
    }
  }

  const resolvedCandidate =
    bestCandidate ??
    ({
      columnCount: 1,
      cardWidthPx: Math.min(safeContainerWidthPx, safeDesiredCardWidthPx),
      deltaPx: Math.abs(Math.min(safeContainerWidthPx, safeDesiredCardWidthPx) - safeDesiredCardWidthPx),
      withinTolerance: false
    } satisfies ResponsiveGridCandidate);

  return {
    fullColumnCount: resolvedCandidate.columnCount,
    cardWidthPx: Number(resolvedCandidate.cardWidthPx.toFixed(2)),
    gapPx: safeGapPx
  };
}

function isBetterGridCandidate(
  candidate: ResponsiveGridCandidate,
  currentBestCandidate: ResponsiveGridCandidate | null,
  desiredCardWidthPx: number
) {
  if (!currentBestCandidate) {
    return true;
  }

  if (candidate.withinTolerance !== currentBestCandidate.withinTolerance) {
    return candidate.withinTolerance;
  }

  if (Math.abs(candidate.deltaPx - currentBestCandidate.deltaPx) > 0.01) {
    return candidate.deltaPx < currentBestCandidate.deltaPx;
  }

  const candidateOvershoots = candidate.cardWidthPx > desiredCardWidthPx;
  const currentBestOvershoots = currentBestCandidate.cardWidthPx > desiredCardWidthPx;
  if (candidateOvershoots !== currentBestOvershoots) {
    return candidateOvershoots === false;
  }

  return candidate.columnCount > currentBestCandidate.columnCount;
}
