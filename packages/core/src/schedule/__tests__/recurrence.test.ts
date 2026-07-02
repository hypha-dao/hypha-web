import { describe, expect, it } from 'vitest';
import {
  buildRecurrenceRuleFromPreset,
  detectRecurrencePreset,
  expandScheduledOccurrenceStarts,
} from '../recurrence';

describe('schedule recurrence', () => {
  it('builds weekly RRULE on the start weekday', () => {
    const startsAt = new Date('2026-06-25T15:00:00.000Z'); // Thursday UTC
    expect(buildRecurrenceRuleFromPreset('weekly', startsAt)).toBe(
      'FREQ=WEEKLY;BYDAY=TH',
    );
  });

  it('detects presets from stored RRULE strings', () => {
    expect(detectRecurrencePreset('FREQ=DAILY')).toBe('daily');
    expect(detectRecurrencePreset('FREQ=WEEKLY;BYDAY=MO')).toBe('weekly');
    expect(detectRecurrencePreset(null)).toBe('none');
  });

  it('expands recurring occurrences inside a range', () => {
    const startsAt = new Date('2026-06-01T10:00:00.000Z');
    const from = new Date('2026-06-01T00:00:00.000Z');
    const to = new Date('2026-06-15T23:59:59.000Z');
    const occurrences = expandScheduledOccurrenceStarts({
      startsAt,
      recurrenceRule: 'FREQ=DAILY',
      from,
      to,
    });

    expect(occurrences.length).toBeGreaterThan(10);
    expect(occurrences[0]?.toISOString()).toBe(startsAt.toISOString());
  });
});
