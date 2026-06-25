export const RECURRENCE_PRESETS = [
  'none',
  'daily',
  'weekly',
  'monthly',
  'yearly',
] as const;

export type RecurrencePreset = (typeof RECURRENCE_PRESETS)[number];

export const REMINDER_MINUTES_OPTIONS = [
  5, 15, 30, 60, 120, 1440, 10080,
] as const;

export type ReminderMinutesOption = (typeof REMINDER_MINUTES_OPTIONS)[number];
