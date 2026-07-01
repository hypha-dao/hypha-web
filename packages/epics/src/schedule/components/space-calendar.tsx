'use client';

import './space-calendar.css';

import * as React from 'react';
import dynamic from 'next/dynamic';
import type {
  DateSelectArg,
  DatesSetArg,
  EventClickArg,
  EventDropArg,
  EventInput,
  CalendarApi,
} from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import rrulePlugin from '@fullcalendar/rrule';
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
} from 'lucide-react';
import {
  getEventDurationMs,
  getScheduledItemTypeColor,
  revalidateScheduledItems,
  toFullCalendarRruleInput,
  useScheduledItemMutations,
  useScheduledItems,
  useSignalDeadlines,
  type Coherence,
  type ScheduledItem,
} from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { resolveDateFnsLocale } from '../../utils/date-fns-locale';
import { resolveFullCalendarLocale } from '../utils/fullcalendar-locale';

const FullCalendar = dynamic(() => import('@fullcalendar/react'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[520px] items-center justify-center rounded-xl border border-border/60 bg-muted/20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

type CalendarView =
  | 'dayGridMonth'
  | 'timeGridWeek'
  | 'timeGridDay'
  | 'listWeek';

function toCalendarEvent(item: ScheduledItem): EventInput {
  const color = getScheduledItemTypeColor(item.type, item.color);
  const base: EventInput = {
    id: String(item.id),
    title: item.title,
    backgroundColor: color,
    borderColor: color,
    extendedProps: {
      scheduledItem: item,
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

const SIGNAL_DEADLINE_COLOR = '#7c3aed';

function toSignalDeadlineEvent(
  signal: Coherence,
  lang: string,
  spaceSlug: string,
): EventInput | null {
  if (!signal.dueAt) return null;
  const dueAt =
    signal.dueAt instanceof Date ? signal.dueAt : new Date(signal.dueAt);
  if (Number.isNaN(dueAt.getTime())) return null;
  const end = new Date(dueAt);
  end.setHours(23, 59, 59, 999);
  if (!signal.slug) return null;
  return {
    id: `signal-deadline-${signal.id}`,
    title: signal.title,
    start: dueAt,
    end,
    allDay: true,
    editable: false,
    backgroundColor: SIGNAL_DEADLINE_COLOR,
    borderColor: SIGNAL_DEADLINE_COLOR,
    extendedProps: {
      signalDeadline: signal,
      signalHref: `/${lang}/dho/${spaceSlug}/coherence/${signal.slug}`,
    },
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

function getSignalHrefFromExtendedProps(
  extendedProps: Record<string, unknown>,
): string | undefined {
  const href = extendedProps.signalHref;
  return typeof href === 'string' && href.length > 0 ? href : undefined;
}

function defaultRangeForView(view: CalendarView, anchor: Date) {
  if (view === 'dayGridMonth') {
    return {
      from: startOfWeek(startOfMonth(anchor), { weekStartsOn: 0 }),
      to: endOfWeek(endOfMonth(anchor), { weekStartsOn: 0 }),
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
    from: startOfWeek(anchor, { weekStartsOn: 0 }),
    to: endOfWeek(anchor, { weekStartsOn: 0 }),
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

function normalizeCalendarEventRange(
  start: Date,
  end: Date | null,
  allDay: boolean,
): { startsAt: Date; endsAt: Date; allDay: boolean } {
  const startsAt = new Date(start);
  let endsAt = end ? new Date(end) : new Date(startsAt);

  if (allDay) {
    startsAt.setHours(0, 0, 0, 0);
    endsAt = new Date(endsAt.getTime() - 86_400_000);
    endsAt.setHours(23, 59, 59, 999);
  }

  return { startsAt, endsAt, allDay };
}

export function SpaceCalendar({ spaceSlug, lang = 'en' }: SpaceCalendarProps) {
  const t = useTranslations('Calendar');
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { getAccessToken, isAuthenticated } = useAuthentication();
  const [authToken, setAuthToken] = React.useState<string | null>(null);

  React.useEffect(() => {
    void getAccessToken().then(setAuthToken);
  }, [getAccessToken]);

  const [view, setView] = React.useState<CalendarView>('dayGridMonth');
  const [anchorDate, setAnchorDate] = React.useState(() => new Date());
  const [range, setRange] = React.useState(() =>
    defaultRangeForView('dayGridMonth', new Date()),
  );

  const { scheduledItems, isLoading, refresh } = useScheduledItems({
    spaceSlug,
    from: range.from,
    to: range.to,
  });

  const { deadlines: signalDeadlines } = useSignalDeadlines(spaceSlug, {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
  });

  const calendarApiRef = React.useRef<CalendarApi | null>(null);

  const calendarEvents = React.useMemo(() => {
    const scheduled = (scheduledItems ?? []).map(toCalendarEvent);
    const signalEvents = signalDeadlines
      .map((signal) => toSignalDeadlineEvent(signal, lang, spaceSlug))
      .filter((event): event is EventInput => event != null);
    return [...scheduled, ...signalEvents];
  }, [scheduledItems, signalDeadlines, lang, spaceSlug]);

  const syncCalendarDate = React.useCallback((date: Date) => {
    calendarApiRef.current?.gotoDate(date);
  }, []);

  const syncCalendarView = React.useCallback((nextView: CalendarView) => {
    calendarApiRef.current?.changeView(nextView);
  }, []);

  const { updateScheduledItem } = useScheduledItemMutations(
    authToken,
    spaceSlug,
    lang,
  );

  const dateFnsLocale = React.useMemo(() => resolveDateFnsLocale(lang), [lang]);
  const fullCalendarLocale = React.useMemo(
    () => resolveFullCalendarLocale(lang),
    [lang],
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
    setRange((prev) =>
      prev.from.getTime() === arg.start.getTime() &&
      prev.to.getTime() === arg.end.getTime()
        ? prev
        : { from: arg.start, to: arg.end },
    );
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
    const signalHref = getSignalHrefFromExtendedProps(
      clickInfo.event.extendedProps as Record<string, unknown>,
    );
    if (signalHref) {
      router.push(signalHref, { scroll: false });
      return;
    }
    if (!isAuthenticated) return;
    const item = isScheduledItem(clickInfo.event.extendedProps.scheduledItem)
      ? clickInfo.event.extendedProps.scheduledItem
      : undefined;
    if (item) openEdit(item);
  };

  const persistAfterMutation = async () => {
    await refresh();
    await revalidateScheduledItems(spaceSlug);
  };

  const handleEventDrop = async (dropInfo: EventDropArg) => {
    if (!isAuthenticated) {
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
    if (!isAuthenticated) {
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
      ? format(anchorDate, 'MMMM yyyy', { locale: dateFnsLocale })
      : view === 'timeGridDay'
      ? format(anchorDate, 'EEEE, MMMM d, yyyy', { locale: dateFnsLocale })
      : `${format(range.from, 'MMM d', { locale: dateFnsLocale })} – ${format(
          range.to,
          'MMM d, yyyy',
          { locale: dateFnsLocale },
        )}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
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
      </div>

      <div className="hypha-space-calendar rounded-xl border border-border/60 bg-card/40 p-3 shadow-sm backdrop-blur-sm md:p-4">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              size="icon"
              aria-label={t('previous')}
              onClick={() => shiftAnchor(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
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
              variant="outline"
              colorVariant="neutral"
              size="icon"
              aria-label={t('next')}
              onClick={() => shiftAnchor(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="ml-2 flex items-center gap-2 text-base font-medium">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span>{headerLabel}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 rounded-lg bg-muted/40 p-1">
            {viewButtons.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  view === id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => {
                  setView(id);
                  syncCalendarView(id);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div
          className={cn(
            'relative min-h-[520px] overflow-hidden rounded-lg',
            resolvedTheme === 'dark' ? 'fc-theme-dark' : 'fc-theme-light',
          )}
        >
          {isLoading && !scheduledItems ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : null}

          <FullCalendar
            key={`${resolvedTheme}`}
            plugins={[
              dayGridPlugin,
              timeGridPlugin,
              listPlugin,
              interactionPlugin,
              rrulePlugin,
            ]}
            initialView={view}
            initialDate={anchorDate}
            headerToolbar={false}
            events={calendarEvents}
            height="auto"
            contentHeight={560}
            selectable={isAuthenticated}
            selectMirror
            editable={isAuthenticated}
            droppable={false}
            eventResizableFromStart={isAuthenticated}
            dayMaxEvents={3}
            nowIndicator
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            allDaySlot
            weekends
            datesSet={handleDatesSet}
            select={handleDateSelect}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            locale={fullCalendarLocale}
            eventTimeFormat={{
              hour: 'numeric',
              minute: '2-digit',
              meridiem: 'short',
            }}
          />
        </div>
      </div>
    </div>
  );
}
