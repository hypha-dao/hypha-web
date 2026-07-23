'use client';

import './space-calendar.css';

import * as React from 'react';
import dynamic from 'next/dynamic';
import type {
  CalendarApi,
  DateSelectArg,
  DatesSetArg,
  DayCellContentArg,
  DayHeaderContentArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventMountArg,
  SlotLabelContentArg,
} from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format as formatDate,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { useFormatter, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import {
  revalidateScheduledItems,
  SCHEDULED_ITEM_TYPES,
  toCalendarEventsInRange,
  useScheduledItemMutations,
  useScheduledItems,
  type ScheduledItem,
} from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { resolveDateFnsLocale } from '../../utils/date-fns-locale';
import {
  getCalendarWeekStartsOn,
  resolveFullCalendarLocale,
} from '../utils/fullcalendar-locale';
import {
  calendarLayoutForView,
  escapeCalendarHtml,
  viewToModifierClass,
  type CalendarView,
} from '../utils/calendar-view-config';
import {
  CALENDAR_VIEW_QUERY_KEY,
  parseCalendarViewMode,
} from '../utils/calendar-view-mode';
import { scheduledItemTypeIconHtml } from '../utils/scheduled-item-type-icon';
import { ScheduledItemEventSheet } from './scheduled-item-event-sheet';

const FullCalendar = dynamic(() => import('./full-calendar-widget'), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden
      className="h-full min-h-[20rem] animate-pulse rounded-lg border border-border/60 bg-muted/15"
    />
  ),
});

const TYPE_LEGEND: {
  type: (typeof SCHEDULED_ITEM_TYPES)[number];
  key: 'type_call' | 'type_event' | 'type_meeting' | 'type_booking';
}[] = [
  { type: 'call', key: 'type_call' },
  { type: 'event', key: 'type_event' },
  { type: 'meeting', key: 'type_meeting' },
  { type: 'booking', key: 'type_booking' },
];

function isScheduledItem(value: unknown): value is ScheduledItem {
  return (
    typeof value === 'object' &&
    value != null &&
    'id' in value &&
    typeof (value as ScheduledItem).id === 'number'
  );
}

function defaultRangeForView(
  view: CalendarView,
  anchor: Date,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6,
) {
  if (view === 'dayGridMonth') {
    return {
      from: startOfWeek(startOfMonth(anchor), { weekStartsOn }),
      to: endOfWeek(endOfMonth(anchor), { weekStartsOn }),
    };
  }
  if (view === 'timeGridDay') {
    const dayStart = new Date(anchor);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(anchor);
    dayEnd.setHours(23, 59, 59, 999);
    return { from: dayStart, to: dayEnd };
  }
  return {
    from: startOfWeek(anchor, { weekStartsOn }),
    to: endOfWeek(anchor, { weekStartsOn }),
  };
}

export type SpaceCalendarProps = {
  spaceSlug: string;
  spaceId: number;
  lang?: string;
};

function buildCalendarPath(lang: string, spaceSlug: string, suffix = '') {
  return `/${lang}/dho/${spaceSlug}/calendar${suffix}`;
}

function buildNewScheduledItemPath(
  lang: string,
  spaceSlug: string,
  draft: { startsAt: Date; endsAt: Date; allDay: boolean },
) {
  const params = new URLSearchParams({
    startsAt: draft.startsAt.toISOString(),
    endsAt: draft.endsAt.toISOString(),
    allDay: draft.allDay ? '1' : '0',
  });
  return `${buildCalendarPath(
    lang,
    spaceSlug,
    '/new-scheduled-item',
  )}?${params.toString()}`;
}

function buildEditScheduledItemPath(
  lang: string,
  spaceSlug: string,
  itemId: number,
) {
  return buildCalendarPath(lang, spaceSlug, `/edit-scheduled-item/${itemId}`);
}

import { normalizeAllDayEventRange } from '../utils/all-day-event-range';

function normalizeCalendarEventRange(
  start: Date,
  end: Date | null,
  allDay: boolean,
): { startsAt: Date; endsAt: Date; allDay: boolean } {
  if (!allDay) {
    const startsAt = new Date(start);
    const endsAt = end ? new Date(end) : new Date(startsAt);
    return { startsAt, endsAt, allDay };
  }
  const normalized = normalizeAllDayEventRange(start, end);
  return { ...normalized, allDay };
}

export function SpaceCalendar({ spaceSlug, lang = 'en' }: SpaceCalendarProps) {
  const t = useTranslations('Calendar');
  const intlFormat = useFormatter();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { resolvedTheme } = useTheme();
  const { isAuthenticated } = useAuthentication();

  const view = React.useMemo((): CalendarView => {
    // Week, day, and agenda views are not ready — keep month until they ship.
    return 'dayGridMonth';
  }, []);

  React.useEffect(() => {
    if (!parseCalendarViewMode(searchParams.get(CALENDAR_VIEW_QUERY_KEY))) {
      return;
    }
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete(CALENDAR_VIEW_QUERY_KEY);
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams]);
  const [anchorDate, setAnchorDate] = React.useState(() => new Date());
  const [range, setRange] = React.useState<{
    from: Date;
    to: Date;
  } | null>(null);
  const [selectedItem, setSelectedItem] = React.useState<ScheduledItem | null>(
    null,
  );
  const [eventSheetOpen, setEventSheetOpen] = React.useState(false);

  const dateFnsLocale = React.useMemo(() => resolveDateFnsLocale(lang), [lang]);
  const weekStartsOn = React.useMemo(
    () => getCalendarWeekStartsOn(lang),
    [lang],
  );

  const effectiveRange = React.useMemo(
    () => range ?? defaultRangeForView(view, anchorDate, weekStartsOn),
    [range, view, anchorDate, weekStartsOn],
  );

  const { scheduledItems, isLoading, refresh } = useScheduledItems({
    spaceSlug,
    from: effectiveRange.from,
    to: effectiveRange.to,
  });

  const calendarApiRef = React.useRef<CalendarApi | null>(null);

  const calendarEvents = React.useMemo(
    () =>
      (scheduledItems ?? []).flatMap((item) =>
        toCalendarEventsInRange(item, effectiveRange, {
          exclusiveEnd: range != null,
        }),
      ),
    [effectiveRange, range, scheduledItems],
  );

  const syncCalendarDate = React.useCallback((date: Date) => {
    calendarApiRef.current?.gotoDate(date);
  }, []);

  const { updateScheduledItem, isAuthReady } = useScheduledItemMutations(
    spaceSlug,
    lang,
  );

  const fullCalendarLocale = React.useMemo(
    () => resolveFullCalendarLocale(lang),
    [lang],
  );
  const calendarLayout = React.useMemo(
    () => calendarLayoutForView(view),
    [view],
  );

  const renderDayHeader = React.useCallback(
    (arg: DayHeaderContentArg) => {
      if (view === 'dayGridMonth') {
        const label = formatDate(arg.date, 'EEE', { locale: dateFnsLocale });
        return {
          html: `<span class="hypha-cal-month-head">${escapeCalendarHtml(
            label,
          )}</span>`,
        };
      }

      const dow = formatDate(arg.date, 'EEE', { locale: dateFnsLocale });
      const dayNum = formatDate(arg.date, 'd');
      const todayClass = arg.isToday ? ' hypha-cal-col-head--today' : '';
      const todayMarkup = arg.isToday
        ? `<span class="hypha-cal-col-head__today">${escapeCalendarHtml(
            t('today'),
          )}</span>`
        : '';
      return {
        html: `<div class="hypha-cal-col-head${todayClass}">
          <span class="hypha-cal-col-head__dow">${escapeCalendarHtml(
            dow,
          )}</span>
          <span class="hypha-cal-col-head__num">${escapeCalendarHtml(
            dayNum,
          )}</span>${todayMarkup}
        </div>`,
      };
    },
    [dateFnsLocale, t, view],
  );

  const renderDayCellContent = React.useCallback(
    (arg: DayCellContentArg) => {
      const dayNum = escapeCalendarHtml(arg.dayNumberText);
      if (!arg.isToday) {
        return { html: `<span class="hypha-cal-day-num">${dayNum}</span>` };
      }
      return {
        html: `<span class="hypha-cal-day-num hypha-cal-day-num--today">
          <span class="hypha-cal-day-num__value">${dayNum}</span>
          <span class="hypha-cal-day-num__badge">${escapeCalendarHtml(
            t('today'),
          )}</span>
        </span>`,
      };
    },
    [t],
  );

  const renderSlotLabel = React.useCallback(
    (arg: SlotLabelContentArg) => {
      const label = formatDate(arg.date, 'HH:mm', { locale: dateFnsLocale });
      return {
        html: `<span class="hypha-cal-slot-label">${escapeCalendarHtml(
          label,
        )}</span>`,
      };
    },
    [dateFnsLocale],
  );

  const formatEventTimeRange = React.useCallback(
    (arg: EventContentArg) => {
      if (arg.event.allDay) return '';
      const start = arg.event.start;
      if (!start) return arg.timeText?.trim() ?? '';
      const startLabel = formatDate(start, 'H:mm', { locale: dateFnsLocale });
      const end = arg.event.end;
      if (!end) return startLabel;
      const endLabel = formatDate(end, 'H:mm', { locale: dateFnsLocale });
      if (startLabel === endLabel) return startLabel;
      return `${startLabel}–${endLabel}`;
    },
    [dateFnsLocale],
  );

  const renderEventContent = React.useCallback(
    (arg: EventContentArg) => {
      const item = isScheduledItem(arg.event.extendedProps.scheduledItem)
        ? arg.event.extendedProps.scheduledItem
        : null;
      const itemType = item?.type ?? 'event';
      const icon = scheduledItemTypeIconHtml(itemType);
      const typeLabel = item ? t(`type_${item.type}` as 'type_call') : '';
      const title = escapeCalendarHtml(arg.event.title);
      const timeRange = escapeCalendarHtml(formatEventTimeRange(arg));

      if (arg.view.type === 'dayGridMonth') {
        const timeMarkup = timeRange
          ? `<span class="hypha-cal-month-event__time">${timeRange}</span>`
          : '';
        return {
          html: `<div class="hypha-cal-month-event">${timeMarkup}<span class="hypha-cal-month-event__title">${title}</span></div>`,
        };
      }

      if (arg.view.type === 'listWeek') {
        return {
          html: `<article class="hypha-cal-agenda-card">
            <div class="hypha-cal-agenda-card__time">${
              timeRange || escapeCalendarHtml(arg.timeText)
            }</div>
            <div class="hypha-cal-agenda-card__body">
              ${
                typeLabel
                  ? `<span class="hypha-cal-agenda-card__type">${icon}${escapeCalendarHtml(
                      typeLabel,
                    )}</span>`
                  : ''
              }
              <span class="hypha-cal-agenda-card__title">${title}</span>
            </div>
          </article>`,
        };
      }

      return {
        html: `<div class="hypha-cal-time-event">
          <div class="hypha-cal-time-event__row">
            ${icon}
            ${
              timeRange
                ? `<span class="hypha-cal-time-event__time">${timeRange}</span>`
                : ''
            }
          </div>
          <span class="hypha-cal-time-event__title">${title}</span>
        </div>`,
      };
    },
    [formatEventTimeRange, t],
  );

  const openCreate = (startsAt: Date, endsAt: Date, allDay: boolean) => {
    router.push(
      buildNewScheduledItemPath(lang, spaceSlug, { startsAt, endsAt, allDay }),
      { scroll: false },
    );
  };

  const openEdit = (item: ScheduledItem) => {
    router.push(buildEditScheduledItemPath(lang, spaceSlug, item.id), {
      scroll: false,
    });
  };

  const handleDatesSet = (arg: DatesSetArg) => {
    calendarApiRef.current = arg.view.calendar;
    const nextStart = arg.view.currentStart;
    setAnchorDate((prev) =>
      prev.getTime() === nextStart.getTime() ? prev : nextStart,
    );
    setRange((prev) => {
      if (
        prev &&
        prev.from.getTime() === arg.start.getTime() &&
        prev.to.getTime() === arg.end.getTime()
      ) {
        return prev;
      }
      return { from: arg.start, to: arg.end };
    });
  };

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    if (!isAuthenticated) return;
    const { startsAt, endsAt, allDay } = normalizeCalendarEventRange(
      selectInfo.start,
      selectInfo.end,
      selectInfo.allDay,
    );
    openCreate(startsAt, endsAt, allDay);
    selectInfo.view.calendar.unselect();
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    const item = isScheduledItem(clickInfo.event.extendedProps.scheduledItem)
      ? clickInfo.event.extendedProps.scheduledItem
      : undefined;
    if (!item) return;
    setSelectedItem(item);
    setEventSheetOpen(true);
  };

  const handleEventDidMount = React.useCallback((info: EventMountArg) => {
    const accent =
      typeof info.event.extendedProps.accentColor === 'string'
        ? info.event.extendedProps.accentColor
        : null;
    if (accent) {
      info.el.style.setProperty('--hypha-cal-accent', accent);
    }
  }, []);

  const persistAfterMutation = async () => {
    await refresh();
    await revalidateScheduledItems(spaceSlug);
  };

  const handleEventDrop = async (dropInfo: EventDropArg) => {
    if (!isAuthenticated || !isAuthReady) {
      dropInfo.revert();
      return;
    }
    const item = isScheduledItem(dropInfo.event.extendedProps.scheduledItem)
      ? dropInfo.event.extendedProps.scheduledItem
      : undefined;
    if (!item || item.recurrenceRule) {
      dropInfo.revert();
      return;
    }
    try {
      const normalized = normalizeCalendarEventRange(
        dropInfo.event.start ?? item.startsAt,
        dropInfo.event.end ?? item.endsAt,
        dropInfo.event.allDay,
      );
      await updateScheduledItem({
        id: item.id,
        ...normalized,
      });
      await persistAfterMutation();
    } catch {
      dropInfo.revert();
    }
  };

  const handleEventResize = async (resizeInfo: EventResizeDoneArg) => {
    if (!isAuthenticated || !isAuthReady) {
      resizeInfo.revert();
      return;
    }
    const item = isScheduledItem(resizeInfo.event.extendedProps.scheduledItem)
      ? resizeInfo.event.extendedProps.scheduledItem
      : undefined;
    if (!item || item.recurrenceRule) {
      resizeInfo.revert();
      return;
    }
    try {
      const normalized = normalizeCalendarEventRange(
        resizeInfo.event.start ?? item.startsAt,
        resizeInfo.event.end ?? item.endsAt,
        resizeInfo.event.allDay,
      );
      await updateScheduledItem({
        id: item.id,
        startsAt: normalized.startsAt,
        endsAt: normalized.endsAt,
      });
      await persistAfterMutation();
    } catch {
      resizeInfo.revert();
    }
  };

  const shiftAnchor = (direction: -1 | 1) => {
    const next =
      view === 'dayGridMonth'
        ? direction === -1
          ? subMonths(anchorDate, 1)
          : addMonths(anchorDate, 1)
        : new Date(
            anchorDate.getTime() +
              direction *
                (view === 'timeGridDay' ? 86_400_000 : 7 * 86_400_000),
          );
    setAnchorDate(next);
    syncCalendarDate(next);
  };

  const headerLabel = formatDate(anchorDate, 'MMMM yyyy', {
    locale: dateFnsLocale,
  });

  const headerContextLabel = formatDate(anchorDate, 'yyyy', {
    locale: dateFnsLocale,
  });

  const itemCount = scheduledItems?.length;

  return (
    <div className="flex h-[calc(100dvh-9.5rem)] min-h-[28rem] flex-col gap-3">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-6 font-medium tracking-tight text-foreground">
            {t('title')}
            {typeof itemCount === 'number' ? (
              <span className="ml-2 text-3 font-normal text-muted-foreground">
                {intlFormat.number(itemCount)}
              </span>
            ) : isLoading ? (
              <span className="ml-2 text-3 font-normal text-muted-foreground">
                …
              </span>
            ) : null}
          </h1>
        </div>
        {isAuthenticated ? (
          <Button
            type="button"
            onClick={() =>
              openCreate(new Date(), new Date(Date.now() + 3_600_000), false)
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('newItem')}
          </Button>
        ) : null}
      </header>

      <div
        className={cn(
          'hypha-space-calendar relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border/70 bg-background-2 p-2.5 md:p-3',
          viewToModifierClass(view),
        )}
      >
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="mb-2.5 flex shrink-0 flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-9 items-stretch overflow-hidden rounded-lg border border-border/70 bg-background">
                <Button
                  type="button"
                  variant="ghost"
                  colorVariant="neutral"
                  size="icon"
                  className="size-9 min-h-0 shrink-0 rounded-none"
                  aria-label={t('previous')}
                  onClick={() => shiftAnchor(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  colorVariant="neutral"
                  size="sm"
                  className="h-9 min-h-0 rounded-none px-3 py-0 text-xs font-medium uppercase tracking-wide"
                  onClick={() => {
                    const today = new Date();
                    setAnchorDate(today);
                    syncCalendarDate(today);
                  }}
                >
                  {t('today')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  colorVariant="neutral"
                  size="icon"
                  className="size-9 min-h-0 shrink-0 rounded-none"
                  aria-label={t('next')}
                  onClick={() => shiftAnchor(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex min-w-0 items-center gap-2 pl-1">
                <CalendarDays
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <p className="truncate text-4 font-medium tracking-tight text-foreground">
                  {headerLabel}
                  <span className="ms-2 text-2 font-normal text-muted-foreground">
                    {headerContextLabel}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border/50 pb-2.5">
              {TYPE_LEGEND.map(({ type, key }) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1.5 text-1 font-medium uppercase tracking-wide text-muted-foreground"
                >
                  <span
                    className={`hypha-cal-legend-dot hypha-cal-legend-dot--${type}`}
                    aria-hidden
                  />
                  {t(key)}
                </span>
              ))}
            </div>
          </div>

          <div
            className={cn(
              'relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border/50 bg-background',
              resolvedTheme === 'dark' ? 'fc-theme-dark' : 'fc-theme-light',
            )}
          >
            <FullCalendar
              key={`${resolvedTheme}-${view}`}
              initialView={view}
              initialDate={anchorDate}
              headerToolbar={false}
              events={calendarEvents}
              height={calendarLayout.height ?? 'auto'}
              contentHeight={calendarLayout.contentHeight}
              selectable={isAuthenticated}
              selectMirror
              editable={isAuthenticated}
              droppable={false}
              eventResizableFromStart={isAuthenticated}
              eventDisplay="block"
              displayEventEnd
              dayMaxEvents={calendarLayout.dayMaxEvents}
              nowIndicator
              slotMinTime={calendarLayout.slotMinTime}
              slotMaxTime={calendarLayout.slotMaxTime}
              slotDuration="00:30:00"
              expandRows
              stickyHeaderDates
              allDaySlot
              weekends
              datesSet={handleDatesSet}
              select={handleDateSelect}
              eventClick={handleEventClick}
              eventDidMount={handleEventDidMount}
              eventContent={renderEventContent}
              dayHeaderContent={renderDayHeader}
              dayCellContent={renderDayCellContent}
              slotLabelContent={renderSlotLabel}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              locale={fullCalendarLocale}
              listDayFormat={{
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              }}
              listDaySideFormat={false}
              eventTimeFormat={{
                hour: 'numeric',
                minute: '2-digit',
                meridiem: false,
                hour12: false,
              }}
            />
          </div>
        </div>
      </div>

      <ScheduledItemEventSheet
        item={selectedItem}
        open={eventSheetOpen}
        onOpenChange={setEventSheetOpen}
        spaceSlug={spaceSlug}
        lang={lang}
        onEdit={(item) => {
          if (!isAuthenticated) return;
          openEdit(item);
        }}
      />
    </div>
  );
}
