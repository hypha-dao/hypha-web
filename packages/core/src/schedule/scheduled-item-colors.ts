import type { ScheduledItemType } from './scheduled-item-types';

/** Default accent colors per scheduled item type (FullCalendar event background). */
export const SCHEDULED_ITEM_TYPE_COLORS: Record<ScheduledItemType, string> = {
  call: '#6366f1',
  event: '#0ea5e9',
  meeting: '#8b5cf6',
  deadline: '#ef4444',
  reminder: '#f59e0b',
  booking: '#14b8a6',
};

export function getScheduledItemTypeColor(
  type: ScheduledItemType,
  override?: string | null,
): string {
  if (override?.trim()) return override.trim();
  return SCHEDULED_ITEM_TYPE_COLORS[type];
}
