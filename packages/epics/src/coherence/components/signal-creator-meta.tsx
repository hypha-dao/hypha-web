'use client';

import { Clock, UserCircle2 } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';

type SignalCreatorMetaProps = {
  creatorDisplayName: string | null;
  createdAtRelative: string;
  className?: string;
};

export function SignalCreatorMeta({
  creatorDisplayName,
  createdAtRelative,
  className,
}: SignalCreatorMetaProps) {
  if (!creatorDisplayName && !createdAtRelative) return null;

  return (
    <div
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground',
        className,
      )}
    >
      {creatorDisplayName ? (
        <span className="inline-flex min-w-0 items-center gap-1 truncate">
          <UserCircle2 className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
          <span className="truncate">{creatorDisplayName}</span>
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
