/**
 * Places the legend and miniature on the drawn globe.
 *
 * The square around the circle has its lower corners outside the disk.
 * Pinning the controls to those corners drops them onto the bottom arc,
 * where the chord is short, so they sit side by side under the middle.
 * Seat each one inside the disk instead: outer edge near the side limb,
 * as low as that still allows, with the open globe between them.
 */

export const OVERLAY_INSET = 12;
export const OVERLAY_GAP = 12;

/**
 * How far the outer edge may sit in from the side limb so the control
 * can drop into the lower half. Larger values walk both controls down
 * onto the narrow bottom chord.
 */
const LIMB_SLACK = 16;

export type OverlaySize = { w: number; h: number };
export type OverlayBox = OverlaySize & { x: number; y: number };
export type OverlayDisk = { cx: number; cy: number; r: number };
export type OverlaySeat = {
  legendLeft: number;
  legendBottom: number;
  navRight: number;
  navBottom: number;
};

function overlayBoxesOverlap(a: OverlayBox, b: OverlayBox): boolean {
  return (
    a.x < b.x + b.w + OVERLAY_GAP &&
    a.x + a.w + OVERLAY_GAP > b.x &&
    a.y < b.y + b.h + OVERLAY_GAP &&
    a.y + a.h + OVERLAY_GAP > b.y
  );
}

/** Half-width of the inset disk at a vertical offset from its center. */
function chordHalf(radius: number, dy: number): number | null {
  const remain = radius * radius - dy * dy;
  if (remain < 0) {
    return null;
  }
  return Math.sqrt(remain);
}

/**
 * Distance from the disk center to the outer edge, with the whole box
 * inside the inset circle. Null when the box is taller or wider than
 * the chord at this drop.
 */
function outerDxAtDrop(
  radius: number,
  size: OverlaySize,
  drop: number,
): number | null {
  const dy = Math.abs(drop) + size.h / 2;
  const half = chordHalf(radius, dy);
  if (half == null || size.w > half * 2 + 0.5) {
    return null;
  }
  return half;
}

function boxOnSide(
  disk: OverlayDisk,
  size: OverlaySize,
  side: 'left' | 'right',
  drop: number,
  outerDx: number,
): OverlayBox {
  const x = side === 'right' ? disk.cx + outerDx - size.w : disk.cx - outerDx;
  return {
    x,
    y: disk.cy + drop - size.h / 2,
    w: size.w,
    h: size.h,
  };
}

/**
 * Lowest seat whose outer edge still reaches the side limb.
 * The equator is the widest chord; dropping further pulls the edge inward,
 * so the search stops once the edge would leave the limb.
 */
function seatOnSide(
  disk: OverlayDisk,
  size: OverlaySize,
  side: 'left' | 'right',
): OverlayBox | null {
  const radius = disk.r - OVERLAY_INSET;
  if (!(radius > 1) || size.w <= 0 || size.h <= 0) {
    return null;
  }
  const widest = outerDxAtDrop(radius, size, 0);
  if (widest == null) {
    return null;
  }
  const minDx = Math.max(0, widest - LIMB_SLACK);
  const maxDrop = Math.max(0, radius - size.h / 2);
  let chosen: OverlayBox | null = null;
  for (let drop = 0; drop <= maxDrop; drop += 1) {
    const outerDx = outerDxAtDrop(radius, size, drop);
    if (outerDx == null || outerDx < minDx) {
      continue;
    }
    chosen = boxOnSide(disk, size, side, drop, outerDx);
  }
  return chosen;
}

function clampBox(box: OverlayBox, width: number, height: number): OverlayBox {
  const maxX = Math.max(OVERLAY_INSET, width - OVERLAY_INSET - box.w);
  const maxY = Math.max(OVERLAY_INSET, height - OVERLAY_INSET - box.h);
  return {
    ...box,
    x: Math.min(Math.max(OVERLAY_INSET, box.x), maxX),
    y: Math.min(Math.max(OVERLAY_INSET, box.y), maxY),
  };
}

function raiseClearOf(
  legend: OverlayBox,
  nav: OverlayBox,
  height: number,
): OverlayBox {
  let y = legend.y;
  let guard = 0;
  while (y > OVERLAY_INSET && overlayBoxesOverlap({ ...legend, y }, nav)) {
    y -= 4;
    guard += 1;
    if (guard > height) {
      break;
    }
  }
  return { ...legend, y: Math.max(OVERLAY_INSET, y) };
}

function toSeat(
  width: number,
  height: number,
  legend: OverlayBox | null,
  nav: OverlayBox,
): OverlaySeat {
  return {
    legendLeft: Math.max(OVERLAY_INSET, Math.round(legend?.x ?? OVERLAY_INSET)),
    legendBottom: Math.max(
      OVERLAY_INSET,
      Math.round(legend ? height - (legend.y + legend.h) : OVERLAY_INSET),
    ),
    navRight: Math.max(OVERLAY_INSET, Math.round(width - (nav.x + nav.w))),
    navBottom: Math.max(OVERLAY_INSET, Math.round(height - (nav.y + nav.h))),
  };
}

/**
 * Legend in the disk's lower-left, miniature in the lower-right.
 * A disk larger than the stage is clipped to the stage, which is the
 * visible drawing once zoom has pushed the limb off the map.
 */
export function seatOnDisk(
  disk: OverlayDisk,
  width: number,
  height: number,
  legend: OverlaySize | null,
  nav: OverlaySize,
): OverlaySeat {
  const navBox = clampBox(
    seatOnSide(disk, nav, 'right') ?? {
      x: width - OVERLAY_INSET - nav.w,
      y: height - OVERLAY_INSET - nav.h,
      w: nav.w,
      h: nav.h,
    },
    width,
    height,
  );
  let legendBox: OverlayBox | null = null;
  if (legend) {
    legendBox = clampBox(
      seatOnSide(disk, legend, 'left') ?? {
        x: OVERLAY_INSET,
        y: height - OVERLAY_INSET - legend.h,
        w: legend.w,
        h: legend.h,
      },
      width,
      height,
    );
    if (overlayBoxesOverlap(legendBox, navBox)) {
      legendBox = raiseClearOf(legendBox, navBox, height);
    }
  }
  return toSeat(width, height, legendBox, navBox);
}
