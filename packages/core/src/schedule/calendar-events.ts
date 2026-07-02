import {
  expandScheduledOccurrenceStarts,
  getEventDurationMs,
} from './recurrence';
import { getScheduledItemTypeColor } from './scheduled-item-colors';
import type { ScheduledItem } from './types';

export type CalendarEventInput = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  backgroundColor: string;
  borderColor: string;
  editable: boolean;
  classNames: string[];
  extendedProps: {
    scheduledItem: ScheduledItem;
    accentColor: string;
  };
};

export function calendarRangeInclusiveTo(
  range: { from: Date; to: Date },
  exclusiveEnd: boolean,
): Date {
  return exclusiveEnd ? new Date(range.to.getTime() - 1) : range.to;
}

export function toCalendarEventsInRange(
  item: ScheduledItem,
  range: { from: Date; to: Date },
  options?: { exclusiveEnd?: boolean },
): CalendarEventInput[] {
  const exclusiveEnd = options?.exclusiveEnd ?? false;
  const isRecurring = Boolean(item.recurrenceRule?.trim());
  const inclusiveTo = calendarRangeInclusiveTo(range, exclusiveEnd);
  const occurrenceStarts = expandScheduledOccurrenceStarts({
    startsAt: item.startsAt,
    recurrenceRule: item.recurrenceRule,
    recurrenceUntil: item.recurrenceUntil,
    from: range.from,
    to: inclusiveTo,
    timezone: item.timezone,
  });

  if (occurrenceStarts.length === 0) return [];

  const accentColor = getScheduledItemTypeColor(item.type, item.color);
  const durationMs = getEventDurationMs(item.startsAt, item.endsAt);

  return occurrenceStarts.map((start) => ({
    id: isRecurring ? `${item.id}:${start.getTime()}` : String(item.id),
    title: item.title,
    start,
    end: new Date(start.getTime() + durationMs),
    allDay: item.allDay,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    editable: !isRecurring,
    classNames: ['hypha-cal-event', `hypha-cal-event--${item.type}`],
    extendedProps: {
      scheduledItem: item,
      accentColor,
    },
  }));
}
