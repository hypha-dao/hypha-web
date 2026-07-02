'use client';

import FullCalendar from '@fullcalendar/react';
import type { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import rrulePlugin from '@fullcalendar/rrule';

const PLUGINS = [
  dayGridPlugin,
  timeGridPlugin,
  listPlugin,
  interactionPlugin,
  rrulePlugin,
];

export type FullCalendarWidgetProps = Omit<CalendarOptions, 'plugins'>;

export default function FullCalendarWidget(props: FullCalendarWidgetProps) {
  return <FullCalendar plugins={PLUGINS} {...props} />;
}
