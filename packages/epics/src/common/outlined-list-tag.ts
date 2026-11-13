import { badgeVariants } from '@hypha-platform/ui';

/**
 * List tags share the design-system Badge outline.
 * Quests should use the same variant, size, and color mapping.
 */
export const OUTLINED_LIST_TAG_VARIANT = 'outline' as const;
export const OUTLINED_LIST_TAG_SIZE = 1 as const;

export type OutlinedListTagColor =
  | 'accent'
  | 'error'
  | 'warn'
  | 'neutral'
  | 'success';

const OUTLINE_COLOR: Record<string, OutlinedListTagColor> = {
  success: 'success',
  error: 'error',
  warn: 'warn',
  neutral: 'neutral',
  accent: 'accent',
  insight: 'accent',
  tension: 'warn',
};

export function outlinedListTagColor(
  colorVariant: string | null | undefined,
): OutlinedListTagColor {
  if (!colorVariant) return 'neutral';
  return OUTLINE_COLOR[colorVariant] ?? 'neutral';
}

/** Classes the outline Badge paints for one list-tag color. */
export function outlinedListTagClassName(
  colorVariant: string | null | undefined,
): string {
  return badgeVariants({
    variant: OUTLINED_LIST_TAG_VARIANT,
    size: OUTLINED_LIST_TAG_SIZE,
    colorVariant: outlinedListTagColor(colorVariant),
  });
}
