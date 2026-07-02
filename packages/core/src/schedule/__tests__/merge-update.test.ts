import { describe, expect, it } from 'vitest';
import { safeParseMergedScheduledItemUpdate } from '../server/merge-scheduled-item-update';
import type { ScheduledItem } from '../types';

function baseExisting(overrides: Partial<ScheduledItem> = {}): ScheduledItem {
  return {
    id: 1,
    spaceId: 1,
    creatorId: 1,
    title: 'tesrt',
    description: null,
    type: 'event',
    startsAt: new Date('2026-07-01T19:15:00.000Z'),
    endsAt: new Date('2026-07-01T20:15:00.000Z'),
    allDay: false,
    timezone: null,
    location: null,
    meetingUrl: null,
    color: null,
    recurrenceRule: null,
    recurrenceUntil: new Date('2026-07-31T22:59:00.000Z'),
    matrixRoomId: null,
    matrixAutoLink: false,
    reminderMinutesBefore: null,
    coherenceId: null,
    createdAt: new Date('2026-07-01T18:18:00.000Z'),
    updatedAt: new Date('2026-07-01T18:18:00.000Z'),
    ...overrides,
  };
}

function baseEditPatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: 'tesrt',
    description: null,
    type: 'event',
    startsAt: '2026-07-01T19:15:00.000Z',
    endsAt: '2026-07-01T20:15:00.000Z',
    allDay: false,
    location: null,
    meetingUrl: null,
    recurrencePreset: 'none',
    recurrenceUntil: null,
    matrixAutoLink: false,
    reminderMinutesBefore: null,
    coherenceId: null,
    ...overrides,
  };
}

describe('safeParseMergedScheduledItemUpdate', () => {
  it('accepts a typical event edit clearing recurrenceUntil', () => {
    const result = safeParseMergedScheduledItemUpdate(
      baseExisting(),
      baseEditPatch({ title: 'tesrt updated' }),
      1,
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recurrenceUntil).toBeNull();
      expect(result.data.recurrenceRule).toBeNull();
    }
  });

  it('accepts call edit with matrixAutoLink and null meetingUrl in patch', () => {
    const result = safeParseMergedScheduledItemUpdate(
      baseExisting({
        type: 'call',
        matrixAutoLink: true,
        meetingUrl: '/en/dho/demo/calendar/join/abc',
        reminderMinutesBefore: 15,
      }),
      baseEditPatch({
        type: 'call',
        matrixAutoLink: true,
        reminderMinutesBefore: 15,
      }),
      1,
    );
    expect(result.success).toBe(true);
  });

  it('accepts call edit when matrixAutoLink is off and meetingUrl is relative', () => {
    const result = safeParseMergedScheduledItemUpdate(
      baseExisting({
        type: 'call',
        matrixAutoLink: false,
        meetingUrl: '/en/dho/demo/calendar/join/abc',
      }),
      baseEditPatch({
        type: 'call',
        matrixAutoLink: false,
        meetingUrl: '/en/dho/demo/calendar/join/abc',
      }),
      1,
    );
    expect(result.success).toBe(true);
  });

  it('rejects invalid meetingUrl values', () => {
    const result = safeParseMergedScheduledItemUpdate(
      baseExisting({
        type: 'call',
        matrixAutoLink: false,
        meetingUrl: 'not-a-url',
      }),
      baseEditPatch({
        type: 'call',
        matrixAutoLink: false,
        meetingUrl: 'not-a-url',
      }),
      1,
    );
    expect(result.success).toBe(false);
  });

  it('rejects invalid reminderMinutesBefore values', () => {
    const result = safeParseMergedScheduledItemUpdate(
      baseExisting({ reminderMinutesBefore: 10 }),
      baseEditPatch({ reminderMinutesBefore: 10 }),
      1,
    );
    expect(result.success).toBe(false);
  });
});
