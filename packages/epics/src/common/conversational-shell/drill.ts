import type { DrillDescriptor, WidgetEvent } from './types';

/**
 * #2486 M9 — a row-level "dig deeper" affordance inside a widget reaches the
 * shell through the existing widget-event channel, shaped as
 * `{ type: 'drill', sourceWidgetId, descriptor }`. This parses + validates one
 * such event into a `{ descriptor, sourceWidgetId }` pair, or `null` when it is
 * not a well-formed drill event.
 */
export function parseDrillEvent(
  event: WidgetEvent,
): { descriptor: DrillDescriptor; sourceWidgetId: string } | null {
  if (!event || event.type !== 'drill') return null;

  const src = event.sourceWidgetId;
  if (typeof src !== 'string' || !src.trim()) return null;

  const d = event.descriptor as Partial<DrillDescriptor> | undefined;
  if (
    !d ||
    typeof d.itemKind !== 'string' ||
    !d.itemKind.trim() ||
    typeof d.label !== 'string' ||
    !d.label.trim()
  ) {
    return null;
  }

  return {
    sourceWidgetId: src,
    descriptor: {
      itemKind: d.itemKind,
      label: d.label,
      scope: d.scope === 'widget' ? 'widget' : 'item',
      ...(typeof d.itemId === 'string' && d.itemId ? { itemId: d.itemId } : {}),
      ...(typeof d.itemSlug === 'string' && d.itemSlug
        ? { itemSlug: d.itemSlug }
        : {}),
    },
  };
}
