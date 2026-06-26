export const SCHEDULED_ITEM_TYPES = [
  'call',
  'event',
  'meeting',
  'deadline',
  'reminder',
  'booking',
] as const;

export type ScheduledItemType = (typeof SCHEDULED_ITEM_TYPES)[number];
