import type { ScheduledItemType } from './scheduled-item-types';

/**
 * Neutral panel step. Calendar chips do not use a per-type hue:
 * a space paints them with `--space-accent`, otherwise `#121212`.
 */
export const SCHEDULED_ITEM_TYPE_COLORS: Record<ScheduledItemType, string> = {
  call: '#121212',
  event: '#121212',
  meeting: '#121212',
  booking: '#121212',
};

export function getScheduledItemTypeColor(
  type: ScheduledItemType,
  override?: string | null,
): string {
  if (override?.trim()) return override.trim();
  return SCHEDULED_ITEM_TYPE_COLORS[type];
}
