'use client';

import type { ReactNode } from 'react';
import { Clock, UserCircle2 } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';

type SignalCreatorMetaProps = {
  /** Prefer `personSlot` when the label is a React node (e.g. resolved assignee). */
  creatorDisplayName?: string | null;
  personSlot?: ReactNode;
  createdAtRelative: string;
  className?: string;
};

export function SignalCreatorMeta({
  creatorDisplayName,
  personSlot,
  createdAtRelative,
  className,
}: SignalCreatorMetaProps) {
  const person =
    personSlot !== undefined ? (
      personSlot
    ) : creatorDisplayName ? (
      <span className="truncate">{creatorDisplayName}</span>
    ) : null;

  if (!person && !createdAtRelative) return null;

  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground',
        className,
      )}
    >
      {person ? (
        <span className="inline-flex min-w-0 items-center gap-1 truncate">
          <UserCircle2
            className="h-3.5 w-3.5 shrink-0 opacity-70"
            aria-hidden
          />
          {person}
        </span>
      ) : null}
      {createdAtRelative ? (
        <span className="inline-flex min-w-0 shrink-0 items-center gap-1">
          <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          {createdAtRelative}
        </span>
      ) : null}
    </div>
  );
}
