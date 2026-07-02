import { Locale } from '@hypha-platform/i18n';
import {
  buildScheduleFromSignalSearchParams,
  type ScheduleFromSignalInput,
  type ScheduledItemType,
} from '@hypha-platform/core/server';

export const getDhoPathCalendar = (lang: Locale, id: string) => {
  return `/${lang}/dho/${id}/calendar`;
};

export function getDhoPathCalendarNewItem(
  lang: Locale,
  id: string,
  draft?: {
    startsAt: Date;
    endsAt: Date;
    allDay: boolean;
    title?: string;
    type?: ScheduledItemType;
    coherenceId?: number | null;
  },
) {
  const base = `/${lang}/dho/${id}/calendar/new-scheduled-item`;
  if (!draft) return base;
  const params = new URLSearchParams({
    startsAt: draft.startsAt.toISOString(),
    endsAt: draft.endsAt.toISOString(),
    allDay: draft.allDay ? '1' : '0',
  });
  if (draft.title?.trim()) params.set('title', draft.title.trim());
  if (draft.type) params.set('type', draft.type);
  if (draft.coherenceId != null) {
    params.set('coherenceId', String(draft.coherenceId));
  }
  return `${base}?${params.toString()}`;
}

export function getDhoPathCalendarScheduleFromSignal(
  lang: Locale,
  id: string,
  input: ScheduleFromSignalInput,
) {
  const params = buildScheduleFromSignalSearchParams(input);
  return `/${lang}/dho/${id}/calendar/new-scheduled-item?${params.toString()}`;
}

export function parseScheduledItemDraftFromSearch(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const read = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const startsAtRaw = read('startsAt');
  const endsAtRaw = read('endsAt');
  if (!startsAtRaw || !endsAtRaw) return null;

  const startsAt = new Date(startsAtRaw);
  const endsAt = new Date(endsAtRaw);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return null;
  }

  const allDay = read('allDay') === '1';
  const title = read('title')?.trim() || undefined;
  const typeRaw = read('type');
  const type: ScheduledItemType | undefined =
    typeRaw === 'call' ||
    typeRaw === 'event' ||
    typeRaw === 'meeting' ||
    typeRaw === 'booking'
      ? typeRaw
      : undefined;
  const coherenceIdRaw = read('coherenceId');
  const coherenceId =
    coherenceIdRaw != null && coherenceIdRaw !== ''
      ? Number.parseInt(coherenceIdRaw, 10)
      : undefined;

  return {
    startsAt,
    endsAt,
    allDay,
    title,
    type,
    coherenceId:
      coherenceId != null && Number.isInteger(coherenceId) && coherenceId > 0
        ? coherenceId
        : undefined,
  };
}

export function getDhoPathCalendarEditItem(
  lang: Locale,
  id: string,
  itemId: number,
) {
  return `/${lang}/dho/${id}/calendar/edit-scheduled-item/${itemId}`;
}
