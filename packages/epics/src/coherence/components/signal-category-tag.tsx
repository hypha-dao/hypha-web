'use client';

import { COHERENCE_TYPE_OPTIONS } from '@hypha-platform/core/client';
import { Badge } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';

const CATEGORY_COLOR = {
  success: 'success',
  error: 'error',
  warn: 'warn',
  accent: 'accent',
  neutral: 'neutral',
  insight: 'accent',
  tension: 'warn',
} as const;

/**
 * Soft steps 3 and 11 are not a contrast pair once a space recolors accent,
 * and that ladder does not flip in dark mode. Step 12 type on a step 3 ground
 * does. Insight uses the solid accent and its contrast ink, which is chosen
 * for that fill in both themes.
 */
const CATEGORY_TONE_CLASS = {
  success: 'border border-success-8 bg-success-3 text-success-12',
  error: 'border border-error-8 bg-error-3 text-error-12',
  warn: 'border border-warning-8 bg-warning-3 text-warning-12',
  neutral: 'border border-neutral-8 bg-neutral-3 text-neutral-12',
  accent:
    'border border-transparent bg-accent-9 text-accent-contrast hover:bg-accent-9 hover:text-accent-contrast',
} as const;

type SignalCategoryTagProps = {
  type?: string | null;
  className?: string;
};

export function SignalCategoryTag({ type, className }: SignalCategoryTagProps) {
  const t = useTranslations('CoherenceTab');
  const value = type?.trim() ?? '';
  if (!value) return null;

  const option = COHERENCE_TYPE_OPTIONS.find((item) => item.type === value);
  const mapped =
    CATEGORY_COLOR[option?.colorVariant as keyof typeof CATEGORY_COLOR] ??
    'neutral';
  const key = `types.${value}`;
  const label = t.has(key as never) ? t(key as never) : option?.title ?? value;

  return (
    <Badge
      variant="soft"
      colorVariant={mapped === 'accent' ? 'neutral' : mapped}
      size={0}
      className={cn(
        'max-w-[8.5rem] shrink-0 truncate text-[10px] font-medium shadow-none',
        CATEGORY_TONE_CLASS[mapped],
        className,
      )}
    >
      {label}
    </Badge>
  );
}
