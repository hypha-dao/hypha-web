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
      colorVariant={mapped}
      size={0}
      className={cn(
        'max-w-[8.5rem] shrink-0 truncate text-[10px] font-medium shadow-none',
        className,
      )}
    >
      {label}
    </Badge>
  );
}
