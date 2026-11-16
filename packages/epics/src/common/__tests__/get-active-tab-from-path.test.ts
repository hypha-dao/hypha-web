import { describe, expect, it } from 'vitest';
import {
  getActiveTabFromPath,
  isEnergyTabPath,
} from '../get-active-tab-from-path';

describe('getActiveTabFromPath', () => {
  it('returns overview when the pathname has no tab segment', () => {
    expect(getActiveTabFromPath('/en/dho/hypha')).toBe('overview');
  });

  it('returns the active tab when present', () => {
    expect(getActiveTabFromPath('/en/dho/hypha/treasury')).toBe('treasury');
  });
});

describe('isEnergyTabPath', () => {
  it('matches the energy tab even when the space slug contains energy', () => {
    expect(
      isEnergyTabPath('/en/dho/ponta-do-sol-energy-community/energy'),
    ).toBe(true);
    expect(
      isEnergyTabPath('/en/dho/ponta-do-sol-energy-community/overview'),
    ).toBe(false);
  });

  it('fails closed on an empty path', () => {
    expect(isEnergyTabPath('')).toBe(false);
    expect(isEnergyTabPath(null)).toBe(false);
  });
});
