'use client';

import { Button } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { Cross2Icon } from '@radix-ui/react-icons';
import type { ReactNode } from 'react';

export type ChromeBannerTone = 'accent' | 'warning' | 'critical';

const toneClasses: Record<
  ChromeBannerTone,
  { shell: string; iconWrap: string }
> = {
  accent: {
    shell:
      'border-accent-8/70 bg-gradient-to-br from-accent-3 via-accent-3 to-accent-4 dark:border-accent-9/50 dark:from-accent-4/90 dark:to-accent-5/80',
    iconWrap:
      'border-accent-9/25 bg-accent-9/12 text-accent-11 dark:bg-accent-9/20 dark:text-accent-11',
  },
  warning: {
    shell:
      'border-warning-9/35 bg-gradient-to-br from-warning-3 via-warning-3 to-warning-4 dark:border-warning-9/40 dark:from-warning-4/85 dark:to-warning-5/70',
    iconWrap:
      'border-warning-9/30 bg-warning-9/14 text-warning-11 dark:bg-warning-9/18 dark:text-warning-11',
  },
  critical: {
    shell:
      'border-error-9/35 bg-gradient-to-br from-error-3 via-error-3 to-error-4 dark:border-error-9/40 dark:from-error-4/85 dark:to-error-5/75',
    iconWrap:
      'border-error-9/30 bg-error-9/12 text-error-11 dark:bg-error-9/18 dark:text-error-11',
  },
};

type ChromeBannerShellProps = {
  tone?: ChromeBannerTone;
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions: ReactNode;
  className?: string;
} & (
  | { onDismiss?: undefined; dismissLabel?: never }
  | { onDismiss: () => void; dismissLabel: string }
);

/**
 * Shared inset-panels / space-header visual language:
 * rounded-2xl-ish card, subtle gradient wash, icon in a tinted disc, refined typography.
 */
export function ChromeBannerShell({
  tone = 'accent',
  icon,
  title,
  subtitle,
  actions,
  onDismiss,
  dismissLabel,
  className,
}: ChromeBannerShellProps) {
  const t = toneClasses[tone];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]',
        t.shell,
        className,
      )}
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:p-5">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-xl border [&_svg]:size-[18px]',
              t.iconWrap,
            )}
            aria-hidden
          >
            {icon}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="text-[13px] font-semibold leading-snug tracking-tight text-foreground sm:text-2">
              {title}
            </div>
            {subtitle ? (
              <div className="text-[13px] leading-snug text-muted-foreground sm:text-2 sm:leading-relaxed">
                {subtitle}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:justify-end">
          {actions}
          {onDismiss ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              aria-label={dismissLabel}
              className={cn(
                'size-9 shrink-0 rounded-full p-0 text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10',
              )}
            >
              <Cross2Icon className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
