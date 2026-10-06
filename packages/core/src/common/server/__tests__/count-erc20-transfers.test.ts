import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  tallyTransfersByMonth,
  transferCountBeforeWindow,
} from '../count-erc20-transfers';

describe('tallyTransfersByMonth', () => {
  it('buckets metadata timestamps into the requested window', () => {
    const tallied = tallyTransfersByMonth(
      [
        { metadata: { blockTimestamp: '2026-09-02T12:00:00.000Z' } },
        { metadata: { blockTimestamp: '2026-09-18T01:00:00.000Z' } },
        { metadata: { blockTimestamp: '2025-08-01T00:00:00.000Z' } },
        { metadata: { blockTimestamp: 'not-a-date' } },
      ],
      ['2026-08', '2026-09'],
    );

    expect(tallied.inWindow.get('2026-09')).toBe(2);
    expect(tallied.inWindow.get('2026-08')).toBe(0);
    expect(tallied.olderThanWindow).toBe(1);
  });
});

describe('transferCountBeforeWindow', () => {
  it('uses remaining transfers as the pre-window baseline', () => {
    expect(
      transferCountBeforeWindow(10, [
        { month: '2026-08', count: 2 },
        { month: '2026-09', count: 3 },
      ]),
    ).toBe(5);
  });
});
