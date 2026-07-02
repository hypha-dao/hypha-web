import { describe, expect, it } from 'vitest';
import {
  calendarViewToUrlSlug,
  isDefaultCalendarViewMode,
  parseCalendarViewMode,
} from '../calendar-view-mode';

describe('parseCalendarViewMode', () => {
  it.each([
    ['month', 'dayGridMonth'],
    ['week', 'timeGridWeek'],
    ['day', 'timeGridDay'],
    ['agenda', 'listWeek'],
  ] as const)('maps %s to %s', (slug, view) => {
    expect(parseCalendarViewMode(slug)).toBe(view);
  });

  it('rejects unknown slugs', () => {
    expect(parseCalendarViewMode('board')).toBeNull();
  });
});

describe('calendarViewToUrlSlug', () => {
  it('round-trips agenda view', () => {
    expect(calendarViewToUrlSlug('listWeek')).toBe('agenda');
  });
});

describe('isDefaultCalendarViewMode', () => {
  it('treats month as default', () => {
    expect(isDefaultCalendarViewMode('dayGridMonth')).toBe(true);
    expect(isDefaultCalendarViewMode('listWeek')).toBe(false);
  });
});
