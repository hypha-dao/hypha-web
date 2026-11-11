'use client';

import {
  canonicalSignalType,
  COHERENCE_TYPES,
  COHERENCE_TYPE_OPTIONS,
} from '@hypha-platform/core/client';
import { Badge } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';
import {
  OUTLINED_LIST_TAG_SIZE,
  OUTLINED_LIST_TAG_VARIANT,
  outlinedListTagColor,
} from '../../common/outlined-list-tag';
import { SignalTypeIcon } from './signal-type-icon';

const TYPE_TONE_CLASS = {
  success: 'text-success-11',
  error: 'text-error-11',
  warn: 'text-warning-11',
  neutral: 'text-neutral-11',
  accent: 'text-accent-11',
  insight: 'text-insight-9',
  tension: 'text-tension-10',
} as const;

type SignalTypeBadgeProps = {
  type?: string | null;
  /** `pill` sits inline in feed rows; `box` heads the signal page. */
  variant?: 'pill' | 'box';
  className?: string;
};

export function SignalTypeBadge({
  type,
  variant = 'pill',
  className,
}: SignalTypeBadgeProps) {
  const t = useTranslations('CoherenceTab');
  const value = canonicalSignalType(type);
  if (!value) return null;

  if (!(COHERENCE_TYPES as readonly string[]).includes(value)) {
    return null;
  }
  const option = COHERENCE_TYPE_OPTIONS.find((item) => item.type === value);
  if (!option) return null;
  const tone =
    TYPE_TONE_CLASS[option.colorVariant as keyof typeof TYPE_TONE_CLASS] ??
    TYPE_TONE_CLASS.neutral;
  const key = `types.${value}`;
  const label = t.has(key as never) ? t(key as never) : option.title;

  if (variant === 'box') {
    return (
      <span
        className={cn(
          'inline-flex w-fit items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase leading-none tracking-[0.08em]',
          'bg-[color-mix(in_oklab,currentColor_10%,transparent)]',
          tone,
          className,
        )}
      >
        <SignalTypeIcon type={value} className="size-3 shrink-0" />
        {label}
      </span>
    );
  }

  return (
    <Badge
      variant={OUTLINED_LIST_TAG_VARIANT}
      size={OUTLINED_LIST_TAG_SIZE}
      colorVariant={outlinedListTagColor(option.colorVariant)}
      className={cn(
        'w-fit shrink-0 gap-1.5 uppercase tracking-[0.06em]',
        className,
      )}
    >
      <SignalTypeIcon type={value} className="size-3 shrink-0" />
      {label}
    </Badge>
  );
}
