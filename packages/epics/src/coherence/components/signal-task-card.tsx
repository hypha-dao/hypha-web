'use client';

import React from 'react';
import { isValid } from 'date-fns';
import { CalendarDays, MessageSquare } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import {
  Coherence,
  SignalBoardDefinition,
  SignalStatusDefinition,
  usePersonById,
} from '@hypha-platform/core/client';
import {
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { PersonAvatar } from '../../people/components/person-avatar';
import { SignalCardActions } from './signal-card-actions';
import { SignalCreatorMeta } from './signal-creator-meta';
import { useSignalCreatorMeta } from '../hooks/use-signal-creator-meta';
import {
  priorityLeftBorderClass,
  statusColorDotClass,
} from '../utils/signal-priority-styles';
import { SignalTagBadges } from './signal-tag-badges';
import { isSignalDueOverdue } from '../utils/signal-due-date';

type SignalTaskCardProps = {
  signal: Coherence;
  status?: SignalStatusDefinition;
  board?: SignalBoardDefinition | null;
  showBoard?: boolean;
  showStatus?: boolean;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  refresh?: () => Promise<void>;
  statusOptions?: SignalStatusDefinition[];
  onStatusChange?: (progressStatus: string) => void;
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
  status,
  board,
  showBoard = true,
  showStatus = false,
  onClick,
  draggable,
  onDragStart,
  onDragEnd,
  onDragOver,
  refresh,
  statusOptions,
  onStatusChange,
  className,
}: SignalTaskCardProps) {
  const t = useTranslations('CoherenceTab');
  const intlFormat = useFormatter();
  const typeLabel = t(
    `types.${signal.type}` as
      | 'types.Opportunity'
      | 'types.Risk'
      | 'types.Tension'
      | 'types.Insight'
      | 'types.Trend'
      | 'types.Proposal',
  );

  const dueDate =
    signal.dueAt instanceof Date
      ? signal.dueAt
      : signal.dueAt
      ? new Date(signal.dueAt)
      : null;
  const hasValidDue = dueDate != null && isValid(dueDate);
  const isOverdue = hasValidDue && isSignalDueOverdue(dueDate);

  const messageCount =
    typeof signal.messages === 'number' && signal.messages > 0
      ? signal.messages
      : 0;
  const priorityLabel = t(
    `priorities.${signal.priority}` as
      | 'priorities.critical'
      | 'priorities.high'
      | 'priorities.medium'
      | 'priorities.low',
  );

  const { creatorDisplayName, createdAtRelative } = useSignalCreatorMeta({
    creatorId: signal.creatorId,
    createdAt: signal.createdAt,
    description: signal.description,
    title: signal.title,
    tags: signal.tags,
  });

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
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
        'group relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm',
        'transition-all duration-200 ease-out',
        'hover:-translate-y-px hover:border-accent-8/45 hover:shadow-md',
        onClick && 'cursor-pointer',
        draggable && 'cursor-grab active:cursor-grabbing',
        className,
      )}
    >
      <div
        className={cn(
          'absolute inset-y-0 left-0 w-1 rounded-l-xl',
          priorityLeftBorderClass(signal.priority),
        )}
        title={priorityLabel}
        aria-label={priorityLabel}
      />

      <div className="relative pl-3 pr-2.5 py-2.5">
        <div className="mb-1.5 flex min-h-6 items-center justify-between gap-1">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            <Badge
              colorVariant="neutral"
              variant="soft"
              className="h-5 shrink-0 truncate px-1.5 text-[10px] font-semibold uppercase tracking-wide"
            >
              {typeLabel}
            </Badge>
            {showStatus && status ? (
              <span className="inline-flex min-w-0 items-center gap-1 truncate text-[10px] font-medium text-muted-foreground">
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    statusColorDotClass(status.color),
                  )}
                  aria-hidden
                />
                {status.name}
              </span>
            ) : null}
          </div>
          {refresh ? (
            <SignalCardActions
              signal={signal}
              refresh={refresh}
              className="shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
            />
          ) : null}
        </div>

        <p className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight text-foreground">
          {signal.title}
        </p>

        <SignalCreatorMeta
          creatorDisplayName={creatorDisplayName}
          createdAtRelative={createdAtRelative}
          className="mt-1"
        />

        {statusOptions && statusOptions.length > 0 && onStatusChange ? (
          <div
            className="mt-2"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <label className="sr-only" htmlFor={`signal-status-${signal.id}`}>
              {t('signalFormStatus')}
            </label>
            <Select
              value={signal.progressStatus ?? statusOptions[0]?.slug}
              onValueChange={onStatusChange}
            >
              <SelectTrigger
                id={`signal-status-${signal.id}`}
                className="h-7 w-full border-border/60 bg-background/80 text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.slug} value={option.slug}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="mt-2.5 flex items-end justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {hasValidDue ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium',
                  isOverdue
                    ? 'bg-error-3 text-error-11'
                    : 'bg-muted/60 text-muted-foreground',
                )}
              >
                <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />
                {intlFormat.dateTime(dueDate, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            ) : null}
            {showBoard && board ? (
              <Badge
                colorVariant="neutral"
                variant="outline"
                className="max-w-[6.5rem] truncate text-[10px]"
              >
                {board.name}
              </Badge>
            ) : null}
            <SignalTagBadges tags={signal.tags} maxVisible={2} />
            {messageCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <MessageSquare className="h-3 w-3" aria-hidden />
                {messageCount}
              </span>
            ) : null}
          </div>
          {signal.assigneeIds.length > 0 ? (
            <AssigneeStack assigneeIds={signal.assigneeIds} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
