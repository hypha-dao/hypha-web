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
  type RecurrencePreset,
  type ScheduledItem,
  type ScheduledItemType,
} from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';
import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { ScheduledItemFormDialog } from './scheduled-item-form-dialog';

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

export function SpaceCalendar({
  spaceSlug,
  spaceId,
  lang = 'en',
}: SpaceCalendarProps) {
  const t = useTranslations('Calendar');
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

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<'create' | 'edit'>(
    'create',
  );
  const [selectedItem, setSelectedItem] = React.useState<ScheduledItem | null>(
    null,
  );
  const [draftRange, setDraftRange] = React.useState<{
    startsAt: Date;
    endsAt: Date;
    allDay: boolean;
  } | null>(null);

  const { scheduledItems, isLoading, refresh } = useScheduledItems({
    spaceSlug,
    from: range.from,
    to: range.to,
  });

  const {
    createScheduledItem,
    updateScheduledItem,
    deleteScheduledItem,
    isCreating,
    isUpdating,
    isDeleting,
  } = useScheduledItemMutations(authToken, spaceSlug, lang);

  const calendarEvents = React.useMemo(
    () => (scheduledItems ?? []).map(toCalendarEvent),
    [scheduledItems],
  );

  const openCreate = (startsAt: Date, endsAt: Date, allDay: boolean) => {
    setDialogMode('create');
    setSelectedItem(null);
    setDraftRange({ startsAt, endsAt, allDay });
    setDialogOpen(true);
  };

  const openEdit = (item: ScheduledItem) => {
    setDialogMode('edit');
    setSelectedItem(item);
    setDraftRange(null);
    setDialogOpen(true);
  };

  const handleDatesSet = (arg: DatesSetArg) => {
    setAnchorDate(arg.view.currentStart);
    setRange({ from: arg.start, to: arg.end });
  };

  const handleDateSelect = (selectInfo: DateSelectArg) => {
    if (!isAuthenticated) return;
    openCreate(selectInfo.start, selectInfo.end, selectInfo.allDay);
    selectInfo.view.calendar.unselect();
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    const item = clickInfo.event.extendedProps.scheduledItem as
      | ScheduledItem
      | undefined;
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
    const item = dropInfo.event.extendedProps.scheduledItem as
      | ScheduledItem
      | undefined;
    if (!item || item.recurrenceRule) {
      dropInfo.revert();
      return;
    }
    try {
      await updateScheduledItem({
        id: item.id,
        startsAt: dropInfo.event.start ?? item.startsAt,
        endsAt: dropInfo.event.end ?? item.endsAt,
        allDay: dropInfo.event.allDay,
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
    const item = resizeInfo.event.extendedProps.scheduledItem as
      | ScheduledItem
      | undefined;
    if (!item || item.recurrenceRule) {
      resizeInfo.revert();
      return;
    }
    try {
      await updateScheduledItem({
        id: item.id,
        startsAt: resizeInfo.event.start ?? item.startsAt,
        endsAt: resizeInfo.event.end ?? item.endsAt,
      });
      await persistAfterMutation();
    } catch {
      resizeInfo.revert();
    }
  };

  const handleSubmit = async (values: {
    title: string;
    description?: string | null;
    type: ScheduledItemType;
    startsAt: Date;
    endsAt: Date;
    allDay: boolean;
    location?: string | null;
    meetingUrl?: string | null;
    recurrencePreset?: RecurrencePreset;
    recurrenceUntil?: Date | null;
    matrixAutoLink?: boolean;
    remindEmail?: boolean;
    remindPush?: boolean;
    reminderMinutesBefore?: number | null;
  }) => {
    if (dialogMode === 'create') {
      await createScheduledItem({
        spaceId,
        ...values,
      });
    } else if (selectedItem) {
      await updateScheduledItem({
        id: selectedItem.id,
        ...values,
      });
    }
    setDialogOpen(false);
    await persistAfterMutation();
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    await deleteScheduledItem({ id: selectedItem.id });
    setDialogOpen(false);
    await persistAfterMutation();
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
    setRange(defaultRangeForView(view, next));
  };

  const viewButtons: { id: CalendarView; label: string }[] = [
    { id: 'dayGridMonth', label: t('viewMonth') },
    { id: 'timeGridWeek', label: t('viewWeek') },
    { id: 'timeGridDay', label: t('viewDay') },
    { id: 'listWeek', label: t('viewAgenda') },
  ];

  const headerLabel =
    view === 'dayGridMonth'
      ? format(anchorDate, 'MMMM yyyy')
      : view === 'timeGridDay'
      ? format(anchorDate, 'EEEE, MMMM d, yyyy')
      : `${format(range.from, 'MMM d')} – ${format(range.to, 'MMM d, yyyy')}`;

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
                setRange(defaultRangeForView(view, today));
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
                  setRange(defaultRangeForView(id, anchorDate));
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
          {isLoading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : null}

          <FullCalendar
            key={`${view}-${resolvedTheme}-${anchorDate.toISOString()}`}
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
            locale={undefined}
            eventTimeFormat={{
              hour: 'numeric',
              minute: '2-digit',
              meridiem: 'short',
            }}
          />
        </div>
      </div>

      <ScheduledItemFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        initialItem={selectedItem}
        draftRange={draftRange}
        isSubmitting={isCreating || isUpdating}
        isDeleting={isDeleting}
        onSubmit={handleSubmit}
        onDelete={dialogMode === 'edit' ? handleDelete : undefined}
      />
    </div>
  );
}
