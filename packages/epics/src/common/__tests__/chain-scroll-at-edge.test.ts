import { describe, expect, it } from 'vitest';

import { boundaryScrollLeftover } from '../chain-scroll-at-edge';

describe('boundaryScrollLeftover', () => {
  it('keeps the page still while the list can still move', () => {
    expect(boundaryScrollLeftover(40, 200, 800, 30)).toBeNull();
    expect(boundaryScrollLeftover(40, 200, 800, -20)).toBeNull();
  });

  it('hands the leftover to the page at the bottom and the top', () => {
    expect(boundaryScrollLeftover(590, 200, 800, 40)).toBe(30);
    expect(boundaryScrollLeftover(0, 200, 800, -25)).toBe(-25);
  });

  it('forwards the whole gesture when the list itself cannot scroll', () => {
    expect(boundaryScrollLeftover(0, 400, 400, 18)).toBe(18);
    expect(boundaryScrollLeftover(0, 400, 400, -12)).toBe(-12);
  });
});
