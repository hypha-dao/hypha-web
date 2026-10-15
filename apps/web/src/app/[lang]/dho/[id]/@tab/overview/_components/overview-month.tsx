'use client';

import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import {
  toCalendarEventsInRange,
  useScheduledItems,
} from '@hypha-platform/core/client';

const HORIZON_DAYS = 45;
const AGENDA_LIMIT = 6;

function startOfDay(date: Date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

export function OverviewMonth({ spaceSlug }: { spaceSlug: string }) {
  const t = useTranslations('OverviewOps');
  const tCalendar = useTranslations('Calendar');
  const format = useFormatter();
  const range = useMemo(() => {
    const from = startOfDay(new Date());
    const to = new Date(from);
    to.setDate(from.getDate() + HORIZON_DAYS);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }, []);
  const { scheduledItems, isLoading } = useScheduledItems({
    spaceSlug,
    from: range.from,
    to: range.to,
  });

  const events = useMemo(() => {
    const today = startOfDay(new Date()).getTime();
    const rows: Array<{
      id: string;
      title: string;
      start: Date;
      end: Date;
      allDay: boolean;
    }> = [];
    for (const item of scheduledItems ?? []) {
      for (const event of toCalendarEventsInRange(item, range)) {
        if (event.end.getTime() < today) continue;
        rows.push({
          id: event.id,
          title: event.title,
          start: event.start,
          end: event.end,
          allDay: event.allDay,
        });
      }
    }
    rows.sort((left, right) => left.start.getTime() - right.start.getTime());
    return rows.slice(0, AGENDA_LIMIT);
  }, [range, scheduledItems]);

  const time = { hour: '2-digit' as const, minute: '2-digit' as const };

  if (isLoading && events.length === 0) {
    return (
      <div className="grid gap-4">
        {Array.from({ length: 3 }, (_, row) => (
          <div
            key={row}
            className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3"
          >
            <span className="h-10 bg-neutral-3" />
            <span className="h-10 bg-neutral-3" />
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <p className="px-5 pb-5 text-2 text-neutral-11">{t('calendarEmpty')}</p>
    );
  }

  return (
    <ol className="flex flex-col">
      {events.map((event) => (
        <li
          key={event.id}
          className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 border-b border-border/50 py-3.5 last:border-b-0"
        >
          <div>
            <span className="block text-1 text-neutral-11">
              {format.dateTime(event.start, { weekday: 'short' })}
            </span>
            <span
              className="block text-4 tabular-nums text-foreground"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {format.dateTime(event.start, { day: 'numeric' })}
            </span>
            <span className="block text-1 text-neutral-11">
              {format.dateTime(event.start, { month: 'short' })}
            </span>
          </div>
          <div className="min-w-0 self-center">
            <p className="truncate text-2 text-foreground">{event.title}</p>
            <p className="mt-1 text-1 text-neutral-11">
              {event.allDay
                ? tCalendar('fieldAllDay')
                : `${format.dateTime(event.start, time)}-${format.dateTime(
                    event.end,
                    time,
                  )}`}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
