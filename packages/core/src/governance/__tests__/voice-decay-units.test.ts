import { describe, it, expect } from 'vitest';
import {
  decayPercentToBasisPoints,
  decayBasisPointsToFormPercent,
} from '../voice-decay-units';

describe('voice-decay-units', () => {
  describe('decayPercentToBasisPoints', () => {
    it('converts UI percent to basis points', () => {
      expect(decayPercentToBasisPoints(1)).toBe(100);
      expect(decayPercentToBasisPoints(17)).toBe(1700);
      expect(decayPercentToBasisPoints(100)).toBe(10_000);
    });

    it('rejects out-of-range values', () => {
      expect(() => decayPercentToBasisPoints(0)).toThrow(RangeError);
      expect(() => decayPercentToBasisPoints(101)).toThrow(RangeError);
    });
  });

  describe('decayBasisPointsToFormPercent', () => {
    it('converts basis points to UI percent', () => {
      expect(decayBasisPointsToFormPercent(100)).toBe(1);
      expect(decayBasisPointsToFormPercent(1700)).toBe(17);
      expect(decayBasisPointsToFormPercent(10_000)).toBe(100);
    });

    it('clamps sub-1% basis points to the UI minimum of 1%', () => {
      expect(decayBasisPointsToFormPercent(1)).toBe(1);
      expect(decayBasisPointsToFormPercent(50)).toBe(1);
    });

    it('returns 1 for invalid or non-positive input', () => {
      expect(decayBasisPointsToFormPercent(0)).toBe(1);
      expect(decayBasisPointsToFormPercent(-5)).toBe(1);
      expect(decayBasisPointsToFormPercent(Number.NaN)).toBe(1);
    });
  });

  it('round-trips common UI values', () => {
    for (const percent of [1, 5, 17, 50, 100]) {
      expect(
        decayBasisPointsToFormPercent(decayPercentToBasisPoints(percent)),
      ).toBe(percent);
    }
  });
});
