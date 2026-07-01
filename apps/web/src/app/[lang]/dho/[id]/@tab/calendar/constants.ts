import { Locale } from '@hypha-platform/i18n';

export const getDhoPathCalendar = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/calendar`;
};

export function getDhoPathCalendarNewItem(
  lang: Locale,
  id: string,
  draft?: { startsAt: Date; endsAt: Date; allDay: boolean },
) {
  const base = `/${lang}/dho/${id}/calendar/new-scheduled-item`;
  if (!draft) return base;
  const params = new URLSearchParams({
    startsAt: draft.startsAt.toISOString(),
    endsAt: draft.endsAt.toISOString(),
    allDay: draft.allDay ? '1' : '0',
  });
  return `${base}?${params.toString()}`;
}

export function getDhoPathCalendarEditItem(
  lang: Locale,
  id: string,
  itemId: number,
) {
  return `/${lang}/dho/${id}/calendar/edit-scheduled-item/${itemId}`;
}
