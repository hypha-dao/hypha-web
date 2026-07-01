'use client';

import './space-calendar.css';

import * as React from 'react';
import dynamic from 'next/dynamic';
import type {
  CalendarApi,
  DateSelectArg,
  DatesSetArg,
  DayHeaderContentArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventInput,
  EventMountArg,
} from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format as formatDate,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns';
import { useFormatter, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import {
  getEventDurationMs,
  getScheduledItemTypeColor,
  revalidateScheduledItems,
  SCHEDULED_ITEM_TYPES,
  toFullCalendarRruleInput,
  useScheduledItemMutations,
  useScheduledItems,
  type ScheduledItem,
} from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';
import { Button, Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui';
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
import { scheduledItemTypeIconHtml } from '../utils/scheduled-item-type-icon';
import { ScheduledItemEventSheet } from './scheduled-item-event-sheet';

const FullCalendar = dynamic(() => import('./full-calendar-widget'), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden
      className="min-h-[520px] animate-pulse rounded-xl border border-border/60 bg-muted/15"
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

function toCalendarEvent(item: ScheduledItem): EventInput {
  const accentColor = getScheduledItemTypeColor(item.type, item.color);
  const base: EventInput = {
    id: String(item.id),
    title: item.title,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    classNames: ['hypha-cal-event', `hypha-cal-event--${item.type}`],
    extendedProps: {
      scheduledItem: item,
      accentColor,
    },
  };

  if (item.recurrenceRule) {
    const rrule = toFullCalendarRruleInput(item);
    if (rrule) {
      return {
        ...base,
        rrule,
        editable: false,
        duration: {
          milliseconds: getEventDurationMs(item.startsAt, item.endsAt),
        },
      };
    }
  }

  return {
    ...base,
    start: item.startsAt,
    end: item.endsAt,
    allDay: item.allDay,
  };
}

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
  const { resolvedTheme } = useTheme();
  const { isAuthenticated } = useAuthentication();

  const [view, setView] = React.useState<CalendarView>('dayGridMonth');
  const [anchorDate, setAnchorDate] = React.useState(() => new Date());
  const [range, setRange] = React.useState<{
    from: Date;
    to: Date;
  } | null>(null);
  const [selectedItem, setSelectedItem] = React.useState<ScheduledItem | null>(
    null,
  );
  const [eventSheetOpen, setEventSheetOpen] = React.useState(false);

  const { scheduledItems, isLoading, refresh } = useScheduledItems({
    spaceSlug,
    from: range?.from ?? null,
    to: range?.to ?? null,
  });

  const calendarApiRef = React.useRef<CalendarApi | null>(null);

  const calendarEvents = React.useMemo(
    () => (scheduledItems ?? []).map(toCalendarEvent),
    [scheduledItems],
  );

  const syncCalendarDate = React.useCallback((date: Date) => {
    calendarApiRef.current?.gotoDate(date);
  }, []);

  const syncCalendarView = React.useCallback((nextView: CalendarView) => {
    calendarApiRef.current?.changeView(nextView);
  }, []);

  const { updateScheduledItem, isAuthReady } = useScheduledItemMutations(
    spaceSlug,
    lang,
  );

  const dateFnsLocale = React.useMemo(() => resolveDateFnsLocale(lang), [lang]);
  const weekStartsOn = React.useMemo(
    () => getCalendarWeekStartsOn(lang),
    [lang],
  );
  const fullCalendarLocale = React.useMemo(
    () => resolveFullCalendarLocale(lang),
    [lang],
  );
  const displayRange = React.useMemo(
    () => range ?? defaultRangeForView(view, anchorDate, weekStartsOn),
    [range, view, anchorDate, weekStartsOn],
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
      return {
        html: `<div class="hypha-cal-col-head${todayClass}">
          <span class="hypha-cal-col-head__dow">${escapeCalendarHtml(
            dow,
          )}</span>
          <span class="hypha-cal-col-head__num">${escapeCalendarHtml(
            dayNum,
          )}</span>
        </div>`,
      };
    },
    [dateFnsLocale, view],
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
      const time = escapeCalendarHtml(arg.timeText);

      if (arg.view.type === 'dayGridMonth') {
        const timeMarkup = time
          ? `<span class="hypha-cal-month-event__time">${time}</span>`
          : '';
        return {
          html: `<div class="hypha-cal-month-event">${icon}${timeMarkup}<span class="hypha-cal-month-event__title">${title}</span></div>`,
        };
      }

      if (arg.view.type === 'listWeek') {
        return {
          html: `<article class="hypha-cal-agenda-card">
            <div class="hypha-cal-agenda-card__time">${time}</div>
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
              time
                ? `<span class="hypha-cal-time-event__time">${time}</span>`
                : ''
            }
          </div>
          <span class="hypha-cal-time-event__title">${title}</span>
        </div>`,
      };
    },
    [t],
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
    info.el.style.backgroundColor = 'transparent';
    info.el.style.borderColor = 'transparent';
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

  const viewButtons: { id: CalendarView; label: string }[] = [
    { id: 'dayGridMonth', label: t('viewMonth') },
    { id: 'timeGridWeek', label: t('viewWeek') },
    { id: 'timeGridDay', label: t('viewDay') },
    { id: 'listWeek', label: t('viewAgenda') },
  ];

  const headerLabel =
    view === 'dayGridMonth'
      ? formatDate(anchorDate, 'MMMM yyyy', { locale: dateFnsLocale })
      : view === 'timeGridDay'
      ? formatDate(anchorDate, 'EEEE, MMMM d, yyyy', { locale: dateFnsLocale })
      : `${formatDate(displayRange.from, 'MMM d', {
          locale: dateFnsLocale,
        })} – ${formatDate(
          range ? subDays(range.to, 1) : displayRange.to,
          'MMM d, yyyy',
          { locale: dateFnsLocale },
        )}`;

  const headerContextLabel =
    view === 'dayGridMonth'
      ? formatDate(anchorDate, 'yyyy', { locale: dateFnsLocale })
      : view === 'timeGridDay'
      ? formatDate(anchorDate, 'EEEE', { locale: dateFnsLocale })
      : t('viewWeek');

  const itemCount = scheduledItems?.length;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-7 font-semibold tracking-tight text-foreground">
            {t('title')}
            {typeof itemCount === 'number' ? (
              <span className="ml-2 text-5 font-medium text-muted-foreground">
                | {intlFormat.number(itemCount)}
              </span>
            ) : isLoading ? (
              <span className="ml-2 text-5 font-medium text-muted-foreground">
                | …
              </span>
            ) : null}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        {isAuthenticated ? (
          <Button
            type="button"
            className="shadow-[0_8px_24px_-12px_hsl(var(--accent-9)/0.65)]"
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
          'hypha-space-calendar relative overflow-hidden rounded-2xl border border-border/45 p-1 shadow-[0_1px_0_hsl(var(--foreground)/0.04)_inset,0_20px_48px_-28px_hsl(var(--accent-9)/0.45)]',
          viewToModifierClass(view),
        )}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--accent-9)/0.14),transparent_70%)]"
          aria-hidden
        />
        <div className="relative rounded-[calc(1rem-4px)] border border-border/35 bg-card/75 p-3 backdrop-blur-sm md:p-4">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-xl border border-border/50 bg-muted/20 p-0.5 shadow-sm">
                <Button
                  type="button"
                  variant="ghost"
                  colorVariant="neutral"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  aria-label={t('previous')}
                  onClick={() => shiftAnchor(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  colorVariant="neutral"
                  className="h-8 rounded-lg px-3 text-xs font-semibold uppercase tracking-wide"
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
                  className="h-8 w-8 rounded-lg"
                  aria-label={t('next')}
                  onClick={() => shiftAnchor(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex min-w-0 items-center gap-3 pl-1">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-accent-8/25 bg-gradient-to-br from-accent-3/80 to-accent-2/30 text-accent-11 shadow-sm">
                  <CalendarDays className="size-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {headerContextLabel}
                  </p>
                  <p className="truncate text-lg font-semibold tracking-tight text-foreground md:text-xl">
                    {headerLabel}
                  </p>
                </div>
              </div>
            </div>

            <Tabs
              value={view}
              onValueChange={(value) => {
                const nextView = value as CalendarView;
                setView(nextView);
                syncCalendarView(nextView);
              }}
            >
              <TabsList
                triggerVariant="switch"
                className="w-fit border border-border/40 bg-muted/25 p-0.5 shadow-inner"
              >
                {viewButtons.map(({ id, label }) => (
                  <TabsTrigger
                    key={id}
                    value={id}
                    variant="switch"
                    className="px-3.5 text-xs font-semibold uppercase tracking-wide"
                  >
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/35 pb-4">
            {TYPE_LEGEND.map(({ type, key }) => (
              <span
                key={type}
                className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground"
              >
                <span
                  className={`hypha-cal-legend-dot hypha-cal-legend-dot--${type}`}
                  aria-hidden
                />
                {t(key)}
              </span>
            ))}
          </div>

          <div
            className={cn(
              'relative overflow-hidden rounded-xl border border-border/30 bg-gradient-to-b from-background/40 via-card/30 to-muted/10',
              view === 'listWeek' ? 'min-h-[480px]' : 'min-h-[520px]',
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
                meridiem: 'short',
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
