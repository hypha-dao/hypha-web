'use client';

import React from 'react';
import { format, isValid } from 'date-fns';
import { Coherence, SignalBoardDefinition, SignalStatusDefinition } from '@hypha-platform/core/client';
import { Badge } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { PersonAvatar } from '../../people/components/person-avatar';
import { usePersonById } from '@hypha-platform/core/client';

type SignalTaskCardProps = {
  signal: Coherence;
  status?: SignalStatusDefinition;
  board?: SignalBoardDefinition | null;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
  className?: string;
};

function AssigneeStack({ assigneeIds }: { assigneeIds: number[] }) {
  const visible = assigneeIds.slice(0, 3);
  return (
    <div className="flex -space-x-1.5">
      {visible.map((id) => (
        <AssigneeAvatar key={id} personId={id} />
      ))}
      {assigneeIds.length > 3 ? (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-background">
          +{assigneeIds.length - 3}
        </span>
      ) : null}
    </div>
  );
}

function AssigneeAvatar({ personId }: { personId: number }) {
  const { person } = usePersonById({ id: personId });
  const label =
    [person?.name, person?.surname].filter(Boolean).join(' ').trim() ||
    person?.nickname ||
    '?';
  return (
    <PersonAvatar
      size="sm"
      avatarSrc={person?.avatarUrl || ''}
      userName={label}
      className="ring-2 ring-background"
    />
  );
}

export function SignalTaskCard({
  signal,
  board,
  onClick,
  draggable,
  onDragStart,
  className,
}: SignalTaskCardProps) {
  const dueDate =
    signal.dueAt instanceof Date
      ? signal.dueAt
      : signal.dueAt
        ? new Date(signal.dueAt)
        : null;
  const hasValidDue = dueDate != null && isValid(dueDate);
  const isOverdue =
    hasValidDue &&
    dueDate.getTime() < Date.now();

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        'rounded-lg border border-border/70 bg-background p-2.5 shadow-sm transition-colors',
        onClick && 'cursor-pointer hover:border-accent-8/50 hover:bg-muted/30',
        draggable && 'cursor-grab active:cursor-grabbing',
        className,
      )}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {signal.type} · {signal.priority}
        </span>
      </div>
      <p className="line-clamp-2 text-sm font-medium leading-snug">{signal.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {hasValidDue ? (
          <span
            className={cn(
              'text-[11px] font-medium',
              isOverdue ? 'text-error-11' : 'text-muted-foreground',
            )}
          >
            {format(dueDate, 'MMM d')}
          </span>
        ) : null}
        {board ? (
          <Badge colorVariant="neutral" className="max-w-[7rem] truncate text-[10px]">
            {board.name}
          </Badge>
        ) : null}
      </div>
      {signal.assigneeIds.length > 0 ? (
        <div className="mt-2">
          <AssigneeStack assigneeIds={signal.assigneeIds} />
        </div>
      ) : null}
    </div>
  );
}
