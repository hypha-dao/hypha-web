import { describe, expect, it } from 'vitest';
import { POLL } from '../poll-intervals';

// Each poll is a billed function run. Changing a tier changes cost for every
// hook that uses it, so a change here should be a deliberate decision.
describe('POLL tiers', () => {
  it('locks the agreed intervals', () => {
    expect(POLL).toEqual({
      LIVE: 5_000,
      ACTIVE: 30_000,
      BACKGROUND: 60_000,
      SLOW: 300_000,
    });
  });

  it('keeps the tiers in increasing order', () => {
    expect(POLL.LIVE).toBeLessThan(POLL.ACTIVE);
    expect(POLL.ACTIVE).toBeLessThan(POLL.BACKGROUND);
    expect(POLL.BACKGROUND).toBeLessThan(POLL.SLOW);
  });
});
