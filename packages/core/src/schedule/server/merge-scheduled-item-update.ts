import type { ScheduledItem } from '../types';

export function mergeScheduledItemUpdateInput(
  existing: ScheduledItem,
  patch: Record<string, unknown>,
  id: number,
) {
  return {
    title: existing.title,
    description: existing.description,
    type: existing.type,
    startsAt: existing.startsAt,
    endsAt: existing.endsAt,
    allDay: existing.allDay,
    timezone: existing.timezone,
    location: existing.location,
    meetingUrl: existing.meetingUrl,
    color: existing.color,
    recurrenceRule: existing.recurrenceRule,
    recurrenceUntil: existing.recurrenceUntil,
    matrixRoomId: existing.matrixRoomId,
    matrixAutoLink: existing.matrixAutoLink,
    remindEmail: existing.remindEmail,
    remindPush: existing.remindPush,
    reminderMinutesBefore: existing.reminderMinutesBefore,
    ...patch,
    id,
  };
}
