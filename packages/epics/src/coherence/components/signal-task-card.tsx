'use client';

import React from 'react';
import { isValid } from 'date-fns';
import { CalendarDays, MessageSquare } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import {
  Coherence,
  SignalBoardDefinition,
  SignalStatusDefinition,
} from '@hypha-platform/core/client';
import { Badge } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { resolveSignalPersonIds, SignalAssignee } from './signal-assignee';
import { SignalCardActions } from './signal-card-actions';
import { SignalDescriptionButton } from './signal-description-dialog';
import { useSignalCreatorMeta } from '../hooks/use-signal-creator-meta';
import {
  PRIORITY_LEFT_ACCENT_BAR_CLASS,
  priorityLeftBorderClass,
  statusColorDotClass,
} from '../utils/signal-priority-styles';
import { SignalTagBadges } from './signal-tag-badges';
import { SignalUpvoteControl } from './signal-upvote-control';
import { isSignalDueOverdue } from '../utils/signal-due-date';
import { getSignalSlugDomProps } from '../lib/signal-deep-link-dom';
import { signalCardActiveClass } from '../utils/signal-active-styles';

type SignalTaskCardProps = {
  signal: Coherence;
  status?: SignalStatusDefinition;
  board?: SignalBoardDefinition | null;
  showBoard?: boolean;
  showStatus?: boolean;
  isActive?: boolean;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  refresh?: () => Promise<void>;
  className?: string;
};

export function SignalTaskCard({
  signal,
  status,
  board,
  showBoard = true,
  showStatus = false,
  isActive = false,
  onClick,
  draggable,
  onDragStart,
  onDragEnd,
  onDragOver,
  refresh,
  className,
}: SignalTaskCardProps) {
  const t = useTranslations('CoherenceTab');
  const intlFormat = useFormatter();
  const hasPersonSlot =
    resolveSignalPersonIds({
      assigneeIds: signal.assigneeIds,
      fallbackPersonId: signal.creatorId,
    }).length > 0;
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

  const { createdAtRelative } = useSignalCreatorMeta({
    creatorId: signal.creatorId,
    createdAt: signal.createdAt,
    description: signal.description,
    title: signal.title,
    tags: signal.tags,
  });

  const stopCardActivation = (event: React.SyntheticEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      {...getSignalSlugDomProps(signal.slug)}
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
        'craft-card-interactive group relative flex flex-col',
        signalCardActiveClass(isActive),
        onClick && 'cursor-pointer',
        draggable && 'cursor-grab active:cursor-grabbing',
        className,
      )}
    >
      <div
        className={cn(
          PRIORITY_LEFT_ACCENT_BAR_CLASS,
          priorityLeftBorderClass(signal.priority),
        )}
        title={priorityLabel}
        aria-label={priorityLabel}
      />

      <div className="relative flex flex-1 flex-col gap-2 pl-3.5 pr-3 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <p className="line-clamp-2 min-w-0 flex-1 text-3 font-medium leading-snug tracking-tight text-foreground">
              {signal.title}
            </p>
            <div className="flex shrink-0 items-center gap-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
              <SignalDescriptionButton
                title={signal.title}
                description={signal.description}
              />
              {refresh ? (
                <div
                  className="flex shrink-0 items-center gap-0"
                  onClick={stopCardActivation}
                  onKeyDown={stopCardActivation}
                >
                  <SignalCardActions
                    signal={signal}
                    refresh={refresh}
                    className="shrink-0"
                  />
                </div>
              ) : null}
            </div>
          </div>

          <p className="truncate text-1 text-muted-foreground">
            <span>{typeLabel}</span>
            {showStatus && status ? (
              <>
                <span className="mx-1.5 text-border" aria-hidden>
                  ·
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className={cn(
                      'h-1.5 w-1.5 shrink-0 rounded-full',
                      statusColorDotClass(status.color),
                    )}
                    aria-hidden
                  />
                  {status.name}
                </span>
              </>
            ) : null}
            {hasPersonSlot ? (
              <>
                <span className="mx-1.5 text-border" aria-hidden>
                  ·
                </span>
                <SignalAssignee
                  assigneeIds={signal.assigneeIds}
                  fallbackPersonId={signal.creatorId}
                  variant="meta"
                  className="min-w-0 truncate"
                />
              </>
            ) : null}
            {createdAtRelative ? (
              <>
                <span className="mx-1.5 text-border" aria-hidden>
                  ·
                </span>
                <span className="tabular-nums">{createdAtRelative}</span>
              </>
            ) : null}
          </p>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2 pt-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <SignalUpvoteControl
              slug={signal.slug}
              upvotes={signal.upvotes}
              refresh={refresh}
              disabled={Boolean(signal.archived)}
            />
            {hasValidDue ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-normal',
                  isOverdue
                    ? 'border-error-7/50 bg-transparent text-error-11'
                    : 'border-border/60 bg-transparent text-muted-foreground',
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
                className="max-w-[6.5rem] truncate border-border/60 bg-transparent text-[10px] font-normal text-muted-foreground shadow-none"
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
        </div>
      </div>
    </div>
  );
}
