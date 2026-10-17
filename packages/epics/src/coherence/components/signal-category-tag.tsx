'use client';

import { COHERENCE_TYPE_OPTIONS } from '@hypha-platform/core/client';
import { DynamicIcon, type LucideReactIcon } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useTranslations } from 'next-intl';

const CATEGORY_TONE_CLASS = {
  success: 'text-success-11',
  error: 'text-error-11',
  warn: 'text-warning-11',
  neutral: 'text-neutral-11',
  accent: 'text-accent-11',
  insight: 'text-insight-9',
  tension: 'text-tension-10',
} as const;

type SignalCategoryTagProps = {
  type?: string | null;
  className?: string;
  /** Show the type name beside the icon, as a tag rather than a bare mark. */
  withLabel?: boolean;
};

export function SignalCategoryTag({
  type,
  className,
  withLabel = false,
}: SignalCategoryTagProps) {
  const t = useTranslations('CoherenceTab');
  const value = type?.trim() ?? '';
  if (!value) return null;

  const option = COHERENCE_TYPE_OPTIONS.find((item) => item.type === value);
  const tone =
    CATEGORY_TONE_CLASS[
      option?.colorVariant as keyof typeof CATEGORY_TONE_CLASS
    ] ?? CATEGORY_TONE_CLASS.neutral;
  const key = `types.${value}`;
  const label = t.has(key as never) ? t(key as never) : option?.title ?? value;
  const icon = (option?.icon ?? 'Circle') as LucideReactIcon;

  if (withLabel) {
    return (
      <span
        title={label}
        className={cn(
          'inline-flex w-fit max-w-full items-center gap-1 border border-border/60 px-1.5 py-0.5 text-1 font-normal leading-[calc(16/12)] tracking-normal normal-case',
          tone,
          className,
        )}
      >
        <DynamicIcon name={icon} size={14} aria-hidden />
        <span className="truncate">{label}</span>
      </span>
    );
  }

  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex h-4 w-4 shrink-0 items-center justify-center',
        tone,
        className,
      )}
    >
      <DynamicIcon name={icon} size={16} aria-hidden />
    </span>
  );
}
