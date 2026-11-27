import { describe, expect, it } from 'vitest';
import { spaceCallBackgroundLayout } from '../space-call-background';

describe('spaceCallBackgroundLayout', () => {
  const W = 1920;
  const H = 1080;

  it('puts a square logo tile towards the top right, inside the 4:3 centre crop', () => {
    const { logo } = spaceCallBackgroundLayout(W, H, true, null);
    expect(logo).not.toBeNull();
    expect(logo!.width).toBe(logo!.height);
    expect(logo!.width).toBe(Math.round(H * 0.18));
    // Right half, upper third.
    expect(logo!.x).toBeGreaterThan(W / 2);
    expect(logo!.y + logo!.height).toBeLessThan(H / 3);
    // A 4:3 cover crop keeps x in [240, 1680].
    expect(logo!.x + logo!.width).toBeLessThanOrEqual(1680);
  });

  it('puts a small mark at the bottom left, keeping its aspect', () => {
    const { mark } = spaceCallBackgroundLayout(W, H, false, 400 / 136);
    expect(mark).not.toBeNull();
    expect(mark!.x).toBeLessThan(W / 4);
    expect(mark!.y).toBeGreaterThan(H * 0.75);
    expect(mark!.y + mark!.height).toBeLessThanOrEqual(H);
    expect(mark!.width / mark!.height).toBeCloseTo(400 / 136, 1);
  });

  it('leaves out what is missing or has no usable size', () => {
    expect(spaceCallBackgroundLayout(W, H, false, null)).toEqual({
      logo: null,
      mark: null,
    });
    expect(spaceCallBackgroundLayout(W, H, false, NaN).mark).toBeNull();
    expect(spaceCallBackgroundLayout(W, H, false, 0).mark).toBeNull();
  });
});
