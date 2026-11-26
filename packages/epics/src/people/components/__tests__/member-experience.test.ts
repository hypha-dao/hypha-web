import { describe, expect, it } from 'vitest';

import {
  readOrientationCookie,
  resolveMemberExperience,
} from '../member-orientation-cookie';

describe('remembered orientation', () => {
  it('accepts only the three personas', () => {
    expect(readOrientationCookie('member')).toBe('member');
    expect(readOrientationCookie('builder')).toBe('builder');
    expect(readOrientationCookie('investor')).toBe('investor');
    expect(readOrientationCookie('admin')).toBeNull();
    expect(readOrientationCookie(undefined)).toBeNull();
  });

  it('uses the cookie only while the profile is still loading', () => {
    expect(
      resolveMemberExperience({
        liveSettled: false,
        liveOrientation: undefined,
        remembered: 'member',
      }),
    ).toEqual({ orientation: 'member', isMember: true, settled: true });

    expect(
      resolveMemberExperience({
        liveSettled: false,
        liveOrientation: undefined,
        remembered: null,
      }),
    ).toEqual({ orientation: null, isMember: false, settled: false });

    expect(
      resolveMemberExperience({
        liveSettled: false,
        liveOrientation: undefined,
        remembered: 'builder',
      }),
    ).toEqual({ orientation: 'builder', isMember: false, settled: true });
  });

  it('follows the loaded profile and ignores a stale cookie', () => {
    expect(
      resolveMemberExperience({
        liveSettled: true,
        liveOrientation: 'builder',
        remembered: 'member',
      }),
    ).toEqual({ orientation: 'builder', isMember: false, settled: true });

    expect(
      resolveMemberExperience({
        liveSettled: true,
        liveOrientation: null,
        remembered: 'member',
      }),
    ).toEqual({ orientation: null, isMember: false, settled: true });
  });
});
