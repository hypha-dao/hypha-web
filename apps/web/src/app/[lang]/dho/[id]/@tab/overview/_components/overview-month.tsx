'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import {
  toCalendarEventsInRange,
  useScheduledItems,
} from '@hypha-platform/core/client';
import { Tooltip, TooltipContent, TooltipTrigger } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function monthGrid(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  const cells: Date[] = [];
  for (let index = 0; index < 42; index += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    cells.push(day);
  }
  while (
    cells.length > 28 &&
    cells[cells.length - 7]!.getMonth() !== anchor.getMonth()
  ) {
    cells.splice(cells.length - 7, 7);
  }
  const from = cells[0]!;
  const to = new Date(cells[cells.length - 1]!);
  to.setHours(23, 59, 59, 999);
  return { cells, from, to };
}

export function OverviewMonth({ spaceSlug }: { spaceSlug: string }) {
  const t = useTranslations('Calendar');
  const format = useFormatter();
  const [anchor, setAnchor] = useState(() => new Date());
  const grid = useMemo(() => monthGrid(anchor), [anchor]);
  const { scheduledItems } = useScheduledItems({
    spaceSlug,
    from: grid.from,
    to: grid.to,
  });

  const byDay = useMemo(() => {
    const map = new Map<
      string,
      { id: string; title: string; start: Date; end: Date; allDay: boolean }[]
    >();
    for (const item of scheduledItems ?? []) {
      for (const event of toCalendarEventsInRange(item, {
        from: grid.from,
        to: grid.to,
      })) {
        const key = dayKey(event.start);
        const list = map.get(key) ?? [];
        list.push({
          id: event.id,
          title: event.title,
          start: event.start,
          end: event.end,
          allDay: event.allDay,
        });
        map.set(key, list);
      }
    }
    for (const list of map.values()) {
      list.sort((left, right) => left.start.getTime() - right.start.getTime());
    }
    return map;
  }, [grid.from, grid.to, scheduledItems]);

  const weekdays = useMemo(() => {
    const monday = new Date(2026, 0, 5);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(monday);
      day.setDate(monday.getDate() + index);
      return format.dateTime(day, { weekday: 'narrow' });
    });
  }, [format]);

  const todayKey = dayKey(new Date());
  const time = { hour: '2-digit' as const, minute: '2-digit' as const };

  return (
    <div className="px-4 pb-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p
          className="text-2 text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {format.dateTime(anchor, { month: 'long', year: 'numeric' })}
        </p>
        <div className="flex items-center">
          <button
            type="button"
            aria-label={t('previous')}
            className="flex h-8 w-8 items-center justify-center text-neutral-11 hover:text-foreground"
            onClick={() =>
              setAnchor(
                (current) =>
                  new Date(current.getFullYear(), current.getMonth() - 1, 1),
              )
            }
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={t('next')}
            className="flex h-8 w-8 items-center justify-center text-neutral-11 hover:text-foreground"
            onClick={() =>
              setAnchor(
                (current) =>
                  new Date(current.getFullYear(), current.getMonth() + 1, 1),
              )
            }
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7">
        {weekdays.map((label, index) => (
          <span key={index} className="pb-2 text-center text-1 text-neutral-11">
            {label}
          </span>
        ))}
        {grid.cells.map((day) => {
          const key = dayKey(day);
          const events = byDay.get(key) ?? [];
          const inMonth = day.getMonth() === anchor.getMonth();
          const mark = (
            <span className="flex flex-col items-center py-1.5">
              <span
                className={cn(
                  'text-1 tabular-nums',
                  inMonth ? 'text-foreground' : 'text-neutral-8',
                  key === todayKey &&
                    'font-medium underline underline-offset-4',
                )}
              >
                {day.getDate()}
              </span>
              <span
                className={cn(
                  'mt-1 size-1',
                  events.length > 0 ? 'bg-foreground' : 'bg-transparent',
                )}
              />
            </span>
          );
          if (events.length === 0) {
            return (
              <div key={key} className="flex justify-center">
                {mark}
              </div>
            );
          }
          return (
            <Tooltip key={key} delayDuration={150}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="flex justify-center hover:bg-foreground/5"
                >
                  {mark}
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="max-w-64 rounded-none border-border bg-background px-3 py-2 text-foreground shadow-none"
              >
                <ul className="grid gap-2">
                  {events.map((event) => (
                    <li key={event.id}>
                      {event.allDay ? null : (
                        <span className="block text-1 text-neutral-11">
                          {format.dateTime(event.start, time)}-
                          {format.dateTime(event.end, time)}
                        </span>
                      )}
                      <span className="block text-1">{event.title}</span>
                    </li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}
