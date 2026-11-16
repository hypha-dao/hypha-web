import { describe, expect, it } from 'vitest';

import { shouldReloadAfterSignOut } from '../sign-out';

describe('shouldReloadAfterSignOut', () => {
  it('reloads when a signed-in visitor becomes signed out', () => {
    expect(shouldReloadAfterSignOut(true, false)).toBe(true);
  });

  it('does not reload on first load, sign-in or no change', () => {
    expect(shouldReloadAfterSignOut(undefined, false)).toBe(false);
    expect(shouldReloadAfterSignOut(undefined, true)).toBe(false);
    expect(shouldReloadAfterSignOut(false, true)).toBe(false);
    expect(shouldReloadAfterSignOut(false, false)).toBe(false);
    expect(shouldReloadAfterSignOut(true, true)).toBe(false);
  });

  it('does not treat an unknown state as a sign-out', () => {
    expect(shouldReloadAfterSignOut(true, undefined)).toBe(false);
  });
});
