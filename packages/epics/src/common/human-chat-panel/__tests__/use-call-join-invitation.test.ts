// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearJoinInviteDismissed,
  persistJoinInviteDismissed,
  readJoinInviteDismissed,
  useCallJoinInvitation,
} from '../use-call-join-invitation';

describe('use-call-join-invitation (CSH-DISCOVER-1)', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('opens once per join-opportunity episode', () => {
    const { result, rerender } = renderHook(
      ({ showJoinOpportunity }) =>
        useCallJoinInvitation({
          roomId: '!room:matrix.org',
          showJoinOpportunity,
        }),
      { initialProps: { showJoinOpportunity: false } },
    );

    expect(result.current.open).toBe(false);
    rerender({ showJoinOpportunity: true });
    expect(result.current.open).toBe(true);

    act(() => {
      result.current.dismiss();
    });
    expect(result.current.open).toBe(false);
    expect(readJoinInviteDismissed('!room:matrix.org')).toBe(true);

    rerender({ showJoinOpportunity: true });
    expect(result.current.open).toBe(false);
  });

  it('opens again on a new join-opportunity episode after dismissal', () => {
    const { result, rerender } = renderHook(
      ({ showJoinOpportunity }) =>
        useCallJoinInvitation({
          roomId: '!room:matrix.org',
          showJoinOpportunity,
        }),
      { initialProps: { showJoinOpportunity: true } },
    );

    expect(result.current.open).toBe(true);
    act(() => {
      result.current.dismiss();
    });
    expect(result.current.open).toBe(false);

    rerender({ showJoinOpportunity: false });
    rerender({ showJoinOpportunity: true });
    expect(result.current.open).toBe(true);
  });

  it('clears dismissal when the join opportunity ends', () => {
    persistJoinInviteDismissed('!room:matrix.org');
    expect(readJoinInviteDismissed('!room:matrix.org')).toBe(true);

    const { rerender } = renderHook(
      ({ showJoinOpportunity }) =>
        useCallJoinInvitation({
          roomId: '!room:matrix.org',
          showJoinOpportunity,
        }),
      { initialProps: { showJoinOpportunity: true } },
    );

    rerender({ showJoinOpportunity: false });
    expect(readJoinInviteDismissed('!room:matrix.org')).toBe(false);
    clearJoinInviteDismissed('!room:matrix.org');
  });
});
