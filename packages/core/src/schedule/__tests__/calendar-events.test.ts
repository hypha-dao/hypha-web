import { describe, expect, it } from 'vitest';
import type { ScheduledItem } from '../types';
import { toCalendarEventsInRange } from '../calendar-events';

function buildItem(overrides: Partial<ScheduledItem> = {}): ScheduledItem {
  return {
    id: 1,
    spaceId: 1,
    creatorId: 1,
    title: 'Alignment Council',
    description: null,
    type: 'call',
    startsAt: new Date('2026-06-29T17:00:00.000Z'),
    endsAt: new Date('2026-06-29T18:30:00.000Z'),
    allDay: false,
    timezone: null,
    location: null,
    meetingUrl: null,
    color: null,
    recurrenceRule: 'FREQ=WEEKLY;BYDAY=MO',
    recurrenceUntil: null,
    matrixRoomId: null,
    matrixAutoLink: false,
    reminderMinutesBefore: null,
    coherenceId: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('toCalendarEventsInRange', () => {
  it('expands weekly Monday calls into concrete agenda events', () => {
    const item = buildItem();
    const range = {
      from: new Date('2026-06-29T00:00:00.000Z'),
      to: new Date('2026-07-06T00:00:00.000Z'),
    };

    const events = toCalendarEventsInRange(item, range, { exclusiveEnd: true });

    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe('Alignment Council');
    expect(events[0]?.start?.toISOString()).toBe('2026-06-29T17:00:00.000Z');
    expect(events[0]?.id).toBe(`1:${events[0]?.start?.getTime()}`);
  });

  it('returns a single non-recurring event when it falls in range', () => {
    const item = buildItem({
      recurrenceRule: null,
      startsAt: new Date('2026-06-30T12:00:00.000Z'),
      endsAt: new Date('2026-06-30T13:00:00.000Z'),
    });
    const range = {
      from: new Date('2026-06-29T00:00:00.000Z'),
      to: new Date('2026-07-06T00:00:00.000Z'),
    };

    const events = toCalendarEventsInRange(item, range, { exclusiveEnd: true });

    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe('1');
  });
});
