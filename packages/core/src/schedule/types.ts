import type { ScheduledItemType } from './scheduled-item-types';
import type { RecurrencePreset } from './recurrence-presets';

export interface ScheduledItem {
  id: number;
  spaceId: number;
  creatorId: number;
  title: string;
  description: string | null;
  type: ScheduledItemType;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  timezone: string | null;
  location: string | null;
  meetingUrl: string | null;
  color: string | null;
  recurrenceRule: string | null;
  recurrenceUntil: Date | null;
  matrixRoomId: string | null;
  matrixAutoLink: boolean;
  reminderMinutesBefore: number | null;
  coherenceId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScheduledItemInput {
  spaceId: number;
  creatorId: number;
  title: string;
  description?: string | null;
  type: ScheduledItemType;
  startsAt: Date;
  endsAt: Date;
  allDay?: boolean;
  timezone?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  color?: string | null;
  recurrenceRule?: string | null;
  recurrenceUntil?: Date | null;
  recurrencePreset?: RecurrencePreset;
  matrixRoomId?: string | null;
  matrixAutoLink?: boolean;
  reminderMinutesBefore?: number | null;
  coherenceId?: number | null;
}

export interface UpdateScheduledItemInput {
  title?: string;
  description?: string | null;
  type?: ScheduledItemType;
  startsAt?: Date;
  endsAt?: Date;
  allDay?: boolean;
  timezone?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  color?: string | null;
  recurrenceRule?: string | null;
  recurrenceUntil?: Date | null;
  recurrencePreset?: RecurrencePreset;
  matrixRoomId?: string | null;
  matrixAutoLink?: boolean;
  reminderMinutesBefore?: number | null;
  coherenceId?: number | null;
}

export type DueScheduledReminder = {
  item: ScheduledItem;
  occurrenceStartsAt: Date;
  spaceSlug: string;
  spaceTitle: string;
  channels: Array<'email' | 'push'>;
};
