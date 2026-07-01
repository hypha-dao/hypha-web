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
  EventMountArg,
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
  format as formatDate,
  startOfMonth,
  startOfWeek,
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
  toFullCalendarRruleInput,
  useScheduledItemMutations,
  useScheduledItems,
  type ScheduledItem,
} from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';
import { Button, Tabs, TabsList, TabsTrigger } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { resolveDateFnsLocale } from '../../utils/date-fns-locale';
import { SpaceAccentLoader } from '../../common/space-accent-loader';
import { resolveFullCalendarLocale } from '../utils/fullcalendar-locale';
import { ScheduledItemEventSheet } from './scheduled-item-event-sheet';

const FullCalendar = dynamic(() => import('@fullcalendar/react'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-[520px] items-center justify-center rounded-xl border border-border/60 bg-muted/20">
      <SpaceAccentLoader size="lg" showLabel={false} />
    </div>
  ),
});

type CalendarView =
  | 'dayGridMonth'
  | 'timeGridWeek'
  | 'timeGridDay'
  | 'listWeek';

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
  const intlFormat = useFormatter();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const { isAuthenticated } = useAuthentication();

  const [view, setView] = React.useState<CalendarView>('dayGridMonth');
  const [anchorDate, setAnchorDate] = React.useState(() => new Date());
  const [range, setRange] = React.useState(() =>
    defaultRangeForView('dayGridMonth', new Date()),
  );
  const [selectedItem, setSelectedItem] = React.useState<ScheduledItem | null>(
    null,
  );
  const [eventSheetOpen, setEventSheetOpen] = React.useState(false);

  const { scheduledItems, isLoading, refresh } = useScheduledItems({
    spaceSlug,
    from: range.from,
    to: range.to,
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
      : `${formatDate(range.from, 'MMM d', {
          locale: dateFnsLocale,
        })} – ${formatDate(range.to, 'MMM d, yyyy', {
          locale: dateFnsLocale,
        })}`;

  const itemCount = scheduledItems?.length;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-7 font-semibold tracking-tight text-foreground">
          {t('title')}
          {typeof itemCount === 'number' ? (
            <span className="ml-2 text-5 font-medium text-muted-foreground">
              | {intlFormat.number(itemCount)}
            </span>
          ) : null}
        </h1>
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

      <div className="hypha-space-calendar rounded-2xl border border-border/50 bg-gradient-to-b from-card via-card/98 to-muted/15 p-3 shadow-sm md:p-4">
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
            <div className="ml-2 flex items-center gap-2 text-base font-semibold tracking-tight">
              <CalendarDays className="h-4 w-4 text-accent-11" />
              <span>{headerLabel}</span>
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
            <TabsList triggerVariant="switch" className="w-fit">
              {viewButtons.map(({ id, label }) => (
                <TabsTrigger key={id} value={id} variant="switch">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div
          className={cn(
            'relative min-h-[520px] overflow-hidden rounded-xl border border-border/35 bg-card/20',
            resolvedTheme === 'dark' ? 'fc-theme-dark' : 'fc-theme-light',
          )}
        >
          {isLoading && !scheduledItems ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
              <SpaceAccentLoader size="md" showLabel={false} />
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
            eventDidMount={handleEventDidMount}
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
