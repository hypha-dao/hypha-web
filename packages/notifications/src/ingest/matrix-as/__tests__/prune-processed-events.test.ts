import { afterEach, describe, expect, it, vi } from 'vitest';

// Column placeholders and a `lt` that records its arguments, so the cutoff can be inspected without
// a real database (the real storage package throws on import without a connection string).
vi.mock('drizzle-orm', () => ({
  lt: (column: unknown, value: unknown) => ({ op: 'lt', column, value }),
}));
vi.mock('@hypha-platform/storage-postgres', () => ({
  notificationProcessedEvents: { dispatchedAt: 'dispatchedAt' },
}));

import { pruneProcessedEvents } from '../dedupe';

const DAY_MS = 24 * 60 * 60 * 1000;

afterEach(() => {
  vi.useRealTimers();
});

function fakeDb(deletedRows: unknown[]) {
  const where = vi.fn(() => ({
    returning: () => Promise.resolve(deletedRows),
  }));
  const db = { delete: () => ({ where }) } as never;
  return { db, where };
}

describe('pruneProcessedEvents', () => {
  it('deletes rows older than the cutoff and returns how many went', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-24T04:00:00.000Z'));
    const { db, where } = fakeDb([{}, {}, {}]);

    await expect(pruneProcessedEvents(7 * DAY_MS, db)).resolves.toBe(3);

    const condition = where.mock.calls[0]?.[0] as unknown as {
      op: string;
      column: string;
      value: Date;
    };
    expect(condition.op).toBe('lt');
    expect(condition.column).toBe('dispatchedAt');
    expect(condition.value.toISOString()).toBe('2026-09-17T04:00:00.000Z');
  });

  it('returns 0 when nothing is old enough', async () => {
    const { db } = fakeDb([]);
    await expect(pruneProcessedEvents(DAY_MS, db)).resolves.toBe(0);
  });
});
