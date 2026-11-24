'use client';

import type { ElementType, ReactNode } from 'react';

import { cn } from '@hypha-platform/ui-utils';

import { MEMBER_EYEBROW } from './member-type';

type MemberEyebrowProps = {
  children: ReactNode;
  /** Lucide (or compatible) icon rendered before the label. */
  icon?: ElementType | null;
  className?: string;
};

/**
 * Member small uppercase label with the screen icon on the left
 * (energy-community: radio beside SIGNALS, etc.).
 */
export function MemberEyebrow({
  children,
  icon: Icon,
  className,
}: MemberEyebrowProps) {
  return (
    <p
      className={cn(
        MEMBER_EYEBROW,
        'inline-flex max-w-full items-center gap-1.5',
        className,
      )}
    >
      {Icon ? (
        <Icon
          className="size-3.5 shrink-0 text-muted-foreground"
          strokeWidth={1.5}
          aria-hidden
        />
      ) : null}
      <span className="min-w-0 truncate">{children}</span>
    </p>
  );
}
