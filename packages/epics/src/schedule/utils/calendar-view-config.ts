export type CalendarView =
  | 'dayGridMonth'
  | 'timeGridWeek'
  | 'timeGridDay'
  | 'listWeek';

export function viewToModifierClass(view: CalendarView): string {
  switch (view) {
    case 'timeGridWeek':
      return 'hypha-space-calendar--week';
    case 'timeGridDay':
      return 'hypha-space-calendar--day';
    case 'listWeek':
      return 'hypha-space-calendar--agenda';
    default:
      return 'hypha-space-calendar--month';
  }
}

export function calendarLayoutForView(view: CalendarView): {
  contentHeight?: number;
  height?: 'auto';
  slotMinTime: string;
  slotMaxTime: string;
  dayMaxEvents: number;
} {
  switch (view) {
    case 'timeGridWeek':
      return {
        contentHeight: 720,
        slotMinTime: '05:00:00',
        slotMaxTime: '23:00:00',
        dayMaxEvents: 4,
      };
    case 'timeGridDay':
      return {
        contentHeight: 780,
        slotMinTime: '05:00:00',
        slotMaxTime: '23:00:00',
        dayMaxEvents: 6,
      };
    case 'listWeek':
      return {
        height: 'auto',
        slotMinTime: '06:00:00',
        slotMaxTime: '22:00:00',
        dayMaxEvents: 4,
      };
    default:
      return {
        contentHeight: 620,
        slotMinTime: '06:00:00',
        slotMaxTime: '22:00:00',
        dayMaxEvents: 4,
      };
  }
}

export function escapeCalendarHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
