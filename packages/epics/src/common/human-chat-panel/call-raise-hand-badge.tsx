'use client';

import { cn } from '@hypha-platform/ui-utils';

type CallRaiseHandBadgeProps = {
  handRaised: boolean;
  order: number | null;
  className?: string;
  positionClass?: string;
  ariaLabel: string;
  title: string;
};

/** Queue position + hand icon on participant tiles (WCUX-REACT-6). */
export function CallRaiseHandBadge({
  handRaised,
  order,
  className,
  positionClass = 'absolute end-1 top-1 z-[5]',
  ariaLabel,
  title,
}: CallRaiseHandBadgeProps) {
  if (!handRaised) return null;

  return (
    <span
      className={cn(
        positionClass,
        'inline-flex items-center gap-0.5 rounded-full bg-black/70 px-1.5 py-0.5 text-white',
        className,
      )}
      aria-label={ariaLabel}
      title={title}
    >
      {order != null ? (
        <span className="text-[10px] font-semibold tabular-nums leading-none">
          {order}
        </span>
      ) : null}
      <span className="text-sm leading-none" aria-hidden>
        ✋
      </span>
    </span>
  );
}
