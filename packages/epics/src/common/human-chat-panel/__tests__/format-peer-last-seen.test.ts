import { describe, expect, it } from 'vitest';

import { peerLastSeenFormatParts } from '../format-peer-last-seen';
import { peerLastSeenLine } from '../../../people/components/member-presence';

describe('peerLastSeenLine', () => {
  it('shows online when presence is active', () => {
    expect(
      peerLastSeenLine({
        level: 'active',
        lastActiveAt: Date.now() - 1_000,
        known: true,
      }),
    ).toEqual({ kind: 'online' });
  });

  it('shows last seen when offline with a timestamp', () => {
    expect(
      peerLastSeenLine({
        level: 'offline',
        lastActiveAt: 1_700_000_000_000,
        known: true,
      }),
    ).toEqual({ kind: 'lastSeenAt', at: 1_700_000_000_000 });
  });

  it('hides the line when presence is unknown', () => {
    expect(
      peerLastSeenLine({
        level: 'offline',
        lastActiveAt: null,
        known: false,
      }),
    ).toEqual({ kind: 'hidden' });
  });
});

describe('peerLastSeenFormatParts', () => {
  const now = new Date('2026-10-31T15:00:00');
  const formatTime = () => '11:00';
  const formatDate = () => '30 Oct 2026';

  it('formats today and yesterday', () => {
    expect(
      peerLastSeenFormatParts(
        new Date('2026-10-31T11:00:00').getTime(),
        formatTime,
        formatDate,
        now,
      ),
    ).toEqual({ key: 'lastSeenToday', time: '11:00' });
    expect(
      peerLastSeenFormatParts(
        new Date('2026-10-30T11:00:00').getTime(),
        formatTime,
        formatDate,
        now,
      ),
    ).toEqual({ key: 'lastSeenYesterday', time: '11:00' });
  });

  it('formats older dates', () => {
    expect(
      peerLastSeenFormatParts(
        new Date('2026-10-20T11:00:00').getTime(),
        formatTime,
        formatDate,
        now,
      ),
    ).toEqual({ key: 'lastSeenDate', date: '30 Oct 2026', time: '11:00' });
  });
});
