import { describe, expect, it, vi } from 'vitest';
import { hangupPairwiseCallsForRemoteUsers } from '../call-pairwise-restart';

describe('hangupPairwiseCallsForRemoteUsers', () => {
  it('hangs up calls whose opponent matches a target user id', () => {
    const hangupA = vi.fn();
    const hangupB = vi.fn();
    const gc = {
      forEachCall: (callback: (call: unknown) => void) => {
        callback({
          getOpponentMember: () => ({ userId: '@a:hs' }),
          callHasEnded: () => false,
          hangup: hangupA,
        });
        callback({
          getOpponentMember: () => ({ userId: '@b:hs' }),
          callHasEnded: () => false,
          hangup: hangupB,
        });
      },
    };

    expect(hangupPairwiseCallsForRemoteUsers(gc, ['@a:hs'])).toBe(1);
    expect(hangupA).toHaveBeenCalledTimes(1);
    expect(hangupB).not.toHaveBeenCalled();
  });

  it('skips calls that already ended', () => {
    const hangup = vi.fn();
    const gc = {
      forEachCall: (callback: (call: unknown) => void) => {
        callback({
          getOpponentMember: () => ({ userId: '@a:hs' }),
          callHasEnded: () => true,
          hangup,
        });
      },
    };

    expect(hangupPairwiseCallsForRemoteUsers(gc, ['@a:hs'])).toBe(0);
    expect(hangup).not.toHaveBeenCalled();
  });
});
