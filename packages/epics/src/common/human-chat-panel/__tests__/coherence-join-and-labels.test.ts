import { describe, expect, it } from 'vitest';

import {
  coherenceJoinTargetKey,
  shouldResetCoherenceTimeline,
  shouldRestartCoherenceJoin,
} from '../coherence-join-target';
import {
  keepVisibleMemberLabel,
  shouldRefreshMemberLabelsAfterIdle,
} from '../member-label-refresh';

describe('coherence join target', () => {
  const key = coherenceJoinTargetKey({
    roomId: '!room:example',
    slug: 'hello',
    spaceSlug: 'hypha',
    isPublic: false,
    channel: null,
  });

  it('does not restart a thread that already settled', () => {
    expect(
      shouldRestartCoherenceJoin({
        settledKey: key,
        joinKey: key,
        openRoomId: '!room:example',
      }),
    ).toBe(false);
  });

  it('restarts when a different room is still open', () => {
    expect(
      shouldRestartCoherenceJoin({
        settledKey: key,
        joinKey: key,
        openRoomId: '!other:example',
      }),
    ).toBe(true);
  });

  it('restarts when the room changes', () => {
    expect(
      shouldRestartCoherenceJoin({
        settledKey: key,
        joinKey: coherenceJoinTargetKey({
          roomId: '!other:example',
          slug: 'hello',
          spaceSlug: 'hypha',
          isPublic: false,
          channel: null,
        }),
        openRoomId: '!room:example',
      }),
    ).toBe(true);
  });

  it('keeps the timeline when the same room is already opening', () => {
    expect(
      shouldResetCoherenceTimeline({
        intendedRoomId: '!room:example',
        openRoomId: null,
        openingRoomId: '!room:example',
      }),
    ).toBe(false);
  });

  it('clears the timeline when switching rooms', () => {
    expect(
      shouldResetCoherenceTimeline({
        intendedRoomId: '!other:example',
        openRoomId: '!room:example',
        openingRoomId: '!room:example',
      }),
    ).toBe(true);
  });
});

describe('member label refresh', () => {
  it('ignores a short tab switch', () => {
    expect(shouldRefreshMemberLabelsAfterIdle(5_000)).toBe(false);
    expect(shouldRefreshMemberLabelsAfterIdle(60_000)).toBe(true);
  });

  it('keeps a visible name when the idle lookup is still a Matrix id', () => {
    expect(
      keepVisibleMemberLabel(
        '@prod_privyabc:matrix.hypha.earth',
        '@prod_privyabc:matrix.hypha.earth',
        'Alex Prate',
      ),
    ).toBe('Alex Prate');
  });

  it('keeps a visible name when the lookup is the unknown placeholder', () => {
    expect(
      keepVisibleMemberLabel(
        '@alex:example',
        'Unknown member',
        'Alex Prate',
        'Unknown member',
      ),
    ).toBe('Alex Prate');
  });

  it('drops the unknown placeholder instead of keeping it as a name', () => {
    expect(
      keepVisibleMemberLabel('@alex:example', 'Unknown', 'Unknown', 'Unknown'),
    ).toBeUndefined();
  });
});
