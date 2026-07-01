import { describe, expect, it } from 'vitest';
import {
  CALL_SCALE_WARNING_DEVICE_THRESHOLD,
  shouldShowCallScaleWarning,
} from '../call-scale-warning';

describe('call-scale-warning (CSH-SCALE-2)', () => {
  it('uses tier M threshold of 12 devices', () => {
    expect(CALL_SCALE_WARNING_DEVICE_THRESHOLD).toBe(12);
  });

  it('warns only above the threshold', () => {
    expect(shouldShowCallScaleWarning(12)).toBe(false);
    expect(shouldShowCallScaleWarning(13)).toBe(true);
  });
});
