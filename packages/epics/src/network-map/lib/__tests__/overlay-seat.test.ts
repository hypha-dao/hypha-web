import { describe, expect, it } from 'vitest';
import { seatOnDisk, type OverlayBox, type OverlayDisk } from '../overlay-seat';

function stageDisk(width: number, height: number): OverlayDisk {
  return {
    cx: width / 2,
    cy: height / 2,
    r: Math.min(width, height) / 2 - 10,
  };
}

function legendBox(
  seat: ReturnType<typeof seatOnDisk>,
  height: number,
  size: { w: number; h: number },
): OverlayBox {
  return {
    x: seat.legendLeft,
    y: height - seat.legendBottom - size.h,
    w: size.w,
    h: size.h,
  };
}

function navBox(
  seat: ReturnType<typeof seatOnDisk>,
  width: number,
  height: number,
  size: { w: number; h: number },
): OverlayBox {
  return {
    x: width - seat.navRight - size.w,
    y: height - seat.navBottom - size.h,
    w: size.w,
    h: size.h,
  };
}

function cornersInside(box: OverlayBox, disk: OverlayDisk): boolean {
  const corners: Array<[number, number]> = [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x, box.y + box.h],
    [box.x + box.w, box.y + box.h],
  ];
  return corners.every(([x, y]) => {
    const dx = x - disk.cx;
    const dy = y - disk.cy;
    return dx * dx + dy * dy <= disk.r * disk.r + 1;
  });
}

describe('seatOnDisk', () => {
  const width = 1200;
  const height = 600;
  const legend = { w: 220, h: 36 };
  const nav = { w: 120, h: 72 };

  it('puts the legend and miniature on opposite lower limbs', () => {
    const disk = stageDisk(width, height);
    const seat = seatOnDisk(disk, width, height, legend, nav);
    const legendSeat = legendBox(seat, height, legend);
    const miniature = navBox(seat, width, height, nav);

    expect(cornersInside(legendSeat, disk)).toBe(true);
    expect(cornersInside(miniature, disk)).toBe(true);

    expect(legendSeat.x).toBeGreaterThanOrEqual(disk.cx - disk.r);
    expect(legendSeat.x).toBeLessThan(disk.cx - disk.r + 48);
    expect(miniature.x + miniature.w).toBeGreaterThan(disk.cx + disk.r - 48);
    expect(miniature.x + miniature.w).toBeLessThanOrEqual(disk.cx + disk.r);

    expect(legendSeat.y + legendSeat.h / 2).toBeGreaterThan(disk.cy);
    expect(miniature.y + miniature.h / 2).toBeGreaterThan(disk.cy);
    expect(legendSeat.y + legendSeat.h).toBeLessThan(disk.cy + disk.r * 0.75);
    expect(miniature.y + miniature.h).toBeLessThan(disk.cy + disk.r * 0.75);

    const gap = miniature.x - (legendSeat.x + legendSeat.w);
    expect(gap).toBeGreaterThan(disk.r * 0.5);
    expect(legendSeat.x + legendSeat.w / 2).toBeLessThan(
      disk.cx - disk.r * 0.25,
    );
    expect(miniature.x + miniature.w / 2).toBeGreaterThan(
      disk.cx + disk.r * 0.25,
    );
  });

  it('keeps a zoomed disk on opposite sides of the stage', () => {
    const disk = { cx: width / 2, cy: height / 2, r: 1400 };
    const seat = seatOnDisk(disk, width, height, legend, nav);
    const legendSeat = legendBox(seat, height, legend);
    const miniature = navBox(seat, width, height, nav);

    expect(legendSeat.x).toBeGreaterThanOrEqual(12);
    expect(miniature.x + miniature.w).toBeLessThanOrEqual(width - 12);
    expect(miniature.x).toBeGreaterThan(legendSeat.x + legendSeat.w);
    expect(legendSeat.x + legendSeat.w / 2).toBeLessThan(width / 2);
    expect(miniature.x + miniature.w / 2).toBeGreaterThan(width / 2);
  });
});
