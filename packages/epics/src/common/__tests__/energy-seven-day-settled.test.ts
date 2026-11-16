import { describe, expect, it } from 'vitest';

import { shouldHoldSettledForDisabledEnergy } from '../energy-seven-day-settled';

describe('shouldHoldSettledForDisabledEnergy', () => {
  it('does not treat the empty SWR state as disabled', () => {
    expect(shouldHoldSettledForDisabledEnergy(false, undefined)).toBe(false);
    expect(shouldHoldSettledForDisabledEnergy(true, undefined)).toBe(false);
  });

  it('holds only after a loaded payload with energy off', () => {
    expect(shouldHoldSettledForDisabledEnergy(false, { enabled: false })).toBe(
      true,
    );
    expect(shouldHoldSettledForDisabledEnergy(true, { enabled: false })).toBe(
      false,
    );
    expect(shouldHoldSettledForDisabledEnergy(false, { enabled: true })).toBe(
      false,
    );
  });
});
