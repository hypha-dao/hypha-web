'use client';

import React from 'react';
import { isValid } from 'date-fns';
import { CalendarDays, MessageSquare, MoreHorizontal } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import {
  Coherence,
  SignalBoardDefinition,
  SignalStatusDefinition,
  usePersonById,
} from '@hypha-platform/core/client';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@hypha-platform/ui';
import { cn, stripDescription, stripMarkdown } from '@hypha-platform/ui-utils';
import { PersonAvatar } from '../../people/components/person-avatar';
import { SignalCardActions } from './signal-card-actions';
import { useSignalCreatorMeta } from '../hooks/use-signal-creator-meta';
import {
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
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-background text-[10px] font-medium text-muted-foreground ring-2 ring-background">
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
  isActive = false,
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

  const plainDescription = React.useMemo(
    () =>
      stripDescription(
        stripMarkdown(signal.description ?? '', {
          orderedListMarkers: false,
          unorderedListMarkers: false,
        }),
      ),
    [signal.description],
  );
  const hasDescription = plainDescription.trim().length > 0;

  const canChangeStatus =
    Boolean(statusOptions?.length) && typeof onStatusChange === 'function';
  const currentStatusSlug =
    signal.progressStatus ?? status?.slug ?? statusOptions?.[0]?.slug ?? '';

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
        !isActive && 'hover:border-border hover:bg-muted/15',
        signalCardActiveClass(isActive),
        onClick && 'cursor-pointer',
        draggable && 'cursor-grab active:cursor-grabbing',
        className,
      )}
    >
      <div
        className={cn(
          'absolute inset-y-0 left-0 w-0.5 rounded-l-lg opacity-80',
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
            <div
              className="flex shrink-0 items-center gap-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
              onClick={stopCardActivation}
              onKeyDown={stopCardActivation}
            >
              {canChangeStatus ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      colorVariant="neutral"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                      aria-label={t('signalFormStatus')}
                      title={t('signalFormStatus')}
                      onClick={stopCardActivation}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="min-w-[10.5rem]"
                    onClick={stopCardActivation}
                  >
                    <DropdownMenuLabel className="text-1 font-normal text-muted-foreground">
                      {t('signalFormStatus')}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                      value={currentStatusSlug}
                      onValueChange={onStatusChange}
                    >
                      {statusOptions!.map((option) => (
                        <DropdownMenuRadioItem
                          key={option.slug}
                          value={option.slug}
                          className="gap-2 text-2"
                        >
                          <span
                            className={cn(
                              'h-1.5 w-1.5 shrink-0 rounded-full',
                              statusColorDotClass(option.color),
                            )}
                            aria-hidden
                          />
                          {option.name}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              {refresh ? (
                <SignalCardActions
                  signal={signal}
                  refresh={refresh}
                  className="shrink-0"
                />
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
            {creatorDisplayName ? (
              <>
                <span className="mx-1.5 text-border" aria-hidden>
                  ·
                </span>
                <span className="truncate">{creatorDisplayName}</span>
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

        {hasDescription ? (
          <p className="line-clamp-2 text-2 leading-snug text-muted-foreground">
            {plainDescription}
          </p>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-2 pt-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <SignalUpvoteControl
              slug={signal.slug}
              upvotes={signal.upvotes}
              refresh={refresh}
              compact
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
          {signal.assigneeIds.length > 0 ? (
            <AssigneeStack assigneeIds={signal.assigneeIds} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
