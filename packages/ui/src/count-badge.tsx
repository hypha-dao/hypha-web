import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@hypha-platform/ui-utils';

const countBadgeVariants = cva(
  [
    'craft-count-chip',
    'inline-grid shrink-0 place-items-center',
    'border border-transparent shadow-none',
    'font-medium tabular-nums leading-none tracking-normal',
    'bg-accent-9 text-accent-contrast',
  ].join(' '),
  {
    variants: {
      size: {
        sm: 'h-3.5 min-h-3.5 text-[9px]',
        md: 'h-[18px] min-h-[18px] text-[10px]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

export function formatCountBadgeLabel(
  count: number,
  capped = false,
): string | null {
  if (count <= 0) return null;
  if (capped || count >= 100) return '99+';
  return String(count);
}

export interface CountBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof countBadgeVariants> {
  count: number;
  /** Homeserver capped unread — force `99+` when count is still positive. */
  capped?: boolean;
  /** Precomputed label; when set, `count`/`capped` are only used if label is omitted. */
  label?: string | null;
}

/**
 * Flat unread/count chip for app chrome (tabs, icon triggers).
 * Circle for a single digit; quiet rounded pill for multi-digit — no drop shadow.
 */
function CountBadge({
  count,
  capped = false,
  label: labelProp,
  size,
  className,
  ...props
}: CountBadgeProps) {
  const label =
    labelProp !== undefined ? labelProp : formatCountBadgeLabel(count, capped);
  if (label == null || label.length === 0) return null;

  const multiDigit = label.length > 1;

  return (
    <span
      aria-hidden
      className={cn(
        countBadgeVariants({ size }),
        multiDigit
          ? size === 'sm'
            ? 'min-w-3.5 rounded-md px-1'
            : 'min-w-[18px] rounded-md px-1.5'
          : size === 'sm'
          ? 'w-3.5 min-w-3.5 rounded-full px-0'
          : 'w-[18px] min-w-[18px] rounded-full px-0',
        className,
      )}
      {...props}
    >
      {label}
    </span>
  );
}

export { CountBadge, countBadgeVariants };
