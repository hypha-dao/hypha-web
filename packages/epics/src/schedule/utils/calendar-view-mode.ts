import type { CalendarView } from './calendar-view-config';

export const CALENDAR_VIEW_QUERY_KEY = 'view';

export const CALENDAR_VIEW_URL_SLUGS = [
  'month',
  'week',
  'day',
  'agenda',
] as const;

export type CalendarViewUrlSlug = (typeof CALENDAR_VIEW_URL_SLUGS)[number];

const SLUG_TO_VIEW: Record<CalendarViewUrlSlug, CalendarView> = {
  month: 'dayGridMonth',
  week: 'timeGridWeek',
  day: 'timeGridDay',
  agenda: 'listWeek',
};

const VIEW_TO_SLUG: Record<CalendarView, CalendarViewUrlSlug> = {
  dayGridMonth: 'month',
  timeGridWeek: 'week',
  timeGridDay: 'day',
  listWeek: 'agenda',
};

export function parseCalendarViewMode(
  raw: string | null | undefined,
): CalendarView | null {
  if (!raw) return null;
  if (!(CALENDAR_VIEW_URL_SLUGS as readonly string[]).includes(raw)) {
    return null;
  }
  return SLUG_TO_VIEW[raw as CalendarViewUrlSlug];
}

export function calendarViewToUrlSlug(view: CalendarView): CalendarViewUrlSlug {
  return VIEW_TO_SLUG[view];
}

export function isDefaultCalendarViewMode(view: CalendarView): boolean {
  return view === 'dayGridMonth';
}
