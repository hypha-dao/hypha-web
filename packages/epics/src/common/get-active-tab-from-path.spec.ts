import { describe, expect, it } from 'vitest';
import { getActiveTabFromPath } from './get-active-tab-from-path';

describe('getActiveTabFromPath', () => {
  it('returns overview when the pathname has no tab segment', () => {
    expect(getActiveTabFromPath('/en/dho/hypha')).toBe('overview');
  });

  it('returns the active tab when present', () => {
    expect(getActiveTabFromPath('/en/dho/hypha/treasury')).toBe('treasury');
  });
});
