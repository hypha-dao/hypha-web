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
import { SignalCardActions } from './signal-card-actions';
import { SignalDescriptionButton } from './signal-description-dialog';
import { useSignalCreatorMeta } from '../hooks/use-signal-creator-meta';
import { SignalTagBadges } from './signal-tag-badges';
import { SignalOwnerSeen } from './signal-owner-seen';
import { SignalIndicativeAmounts } from './signal-indicative-amounts';
import { SignalCategoryTag } from './signal-category-tag';
import { SignalUpvoteControl } from './signal-upvote-control';
import { isSignalDueOverdue } from '../utils/signal-due-date';
import { SIGNAL_BOARD_META_TEXT_CLASS } from '../utils/signal-tag-badge-styles';
import { getSignalSlugDomProps } from '../lib/signal-deep-link-dom';
import { resolveSignalVideo } from '../utils/signal-video';
import { SignalVideoPlayer } from './signal-video-player';
import { signalCardActiveClass } from '../utils/signal-active-styles';
import {
  PRIORITY_DOT_MARK_CLASS,
  priorityDotClass,
} from '../utils/signal-priority-styles';

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
  /**
   * UpVote (grid) only: show a short description when the card has no media.
   * Keep off for board / swimlane / list so those layouts stay dense.
   */
  showDescriptionPreview?: boolean;
};

/** Linear HTML-ish strip — avoid `/<[^>]*>/` (CodeQL ReDoS on uncontrolled copy). */
function plainSignalDescription(value: string | null | undefined) {
  const raw = value ?? '';
  let out = '';
  let index = 0;
  while (index < raw.length) {
    const open = raw.indexOf('<', index);
    if (open === -1) {
      out += raw.slice(index);
      break;
    }
    out += raw.slice(index, open);
    const close = raw.indexOf('>', open + 1);
    if (close === -1) {
      out += raw.slice(open);
      break;
    }
    out += ' ';
    index = close + 1;
  }
  return out
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&NBSP;', ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

export const SignalTaskCard = React.memo(function SignalTaskCard({
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
  showDescriptionPreview = false,
}: SignalTaskCardProps) {
  const t = useTranslations('CoherenceTab');
  const intlFormat = useFormatter();
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

  const { createdAtRelative, creatorDisplayName } = useSignalCreatorMeta({
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

  // Signal type (Opportunity/Risk/…) is deliberately absent: it repeated on
  // every card without changing what anyone does next.
  const metaParts: Array<{ key: string; node: React.ReactNode }> = [];
  if (showStatus && status) {
    metaParts.push({
      key: 'status',
      node: (
        <span className="inline-flex min-w-0 items-center">
          <span className="truncate">{status.name}</span>
        </span>
      ),
    });
  }
  if (creatorDisplayName) {
    metaParts.push({
      key: 'creator',
      node: <span className="min-w-0 truncate">{creatorDisplayName}</span>,
    });
  }
  if (createdAtRelative) {
    metaParts.push({
      key: 'created',
      node: <span className="shrink-0 tabular-nums">{createdAtRelative}</span>,
    });
  }

  const video = resolveSignalVideo(signal.videoUrl);
  const hasCardMedia = Boolean(
    video || signal.leadImage?.trim() || (signal.attachments?.length ?? 0) > 0,
  );
  const descriptionPreview =
    showDescriptionPreview && !hasCardMedia
      ? plainSignalDescription(signal.description)
      : '';

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
      {video ? (
        <div
          className="relative aspect-video w-full overflow-hidden bg-neutral-3"
          onClick={(event) => event.stopPropagation()}
        >
          <SignalVideoPlayer video={video} title={signal.title} />
        </div>
      ) : signal.leadImage ? (
        <img
          src={signal.leadImage}
          alt=""
          className="block w-full object-cover"
          style={{ height: 160 }}
        />
      ) : null}
      <div
        className={cn(
          'flex flex-1 flex-col px-3 pb-3',
          video || signal.leadImage ? 'pt-2.5' : 'pt-3',
        )}
      >
        {/* Own row above the title. Collapsed until hover, focus, or selection
            so the buttons never paint over the type. */}
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-150 ease-out',
            'group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr] [@media(hover:none)]:grid-rows-[1fr]',
            isActive ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className={cn(
                'flex items-center justify-end gap-1 pb-2 transition-opacity duration-150',
                'group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100',
                isActive ? 'opacity-100' : 'opacity-0',
              )}
            >
              <SignalDescriptionButton
                title={signal.title}
                description={signal.description}
                className="rounded-none border border-border/70 bg-background-2 shadow-none"
              />
              {refresh ? (
                <div
                  className="flex shrink-0 items-center"
                  onClick={stopCardActivation}
                  onKeyDown={stopCardActivation}
                >
                  <SignalCardActions
                    signal={signal}
                    refresh={refresh}
                    className="shrink-0 rounded-none border border-border/70 bg-background-2 shadow-none"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-start gap-2">
          <span
            className={cn(
              PRIORITY_DOT_MARK_CLASS,
              'mt-1.5',
              priorityDotClass(signal.priority),
            )}
            title={priorityLabel}
            aria-label={priorityLabel}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2 self-stretch">
            <div className="flex min-w-0 flex-col gap-1">
              <p
                className="line-clamp-3 text-2 font-medium leading-snug tracking-tight text-foreground"
                title={signal.title}
              >
                {signal.title}
              </p>

              <SignalIndicativeAmounts payouts={signal.indicativePayouts} />

              {metaParts.length > 0 ? (
                <p className="flex min-w-0 items-center text-1 text-muted-foreground">
                  {metaParts.map((part, index) => (
                    <React.Fragment key={part.key}>
                      {index > 0 ? (
                        <span
                          className="mx-1.5 shrink-0 text-border"
                          aria-hidden
                        >
                          ·
                        </span>
                      ) : null}
                      {part.node}
                    </React.Fragment>
                  ))}
                </p>
              ) : null}

              {descriptionPreview ? (
                <p className="mt-1 line-clamp-4 text-1 leading-relaxed text-neutral-11">
                  {descriptionPreview}
                </p>
              ) : null}
            </div>

            <div className="mt-auto flex items-end justify-between gap-2 pt-0.5">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <SignalCategoryTag type={signal.type} />
                <SignalUpvoteControl
                  slug={signal.slug}
                  upvotes={signal.upvotes}
                  refresh={refresh}
                  disabled={Boolean(signal.archived)}
                />
                {hasValidDue ? (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-[11px] font-normal',
                      isOverdue ? 'text-error-11' : 'text-muted-foreground',
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
                    className={cn(
                      SIGNAL_BOARD_META_TEXT_CLASS,
                      'max-w-[6.5rem] truncate rounded-none border-border/60 bg-transparent text-muted-foreground shadow-none',
                    )}
                  >
                    {board.name}
                  </Badge>
                ) : null}
                <SignalTagBadges tags={signal.tags} maxVisible={2} />
                <SignalOwnerSeen
                  assigneeIds={signal.assigneeIds}
                  acknowledgements={signal.assigneeAcknowledgedAt}
                />
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
      </div>
    </div>
  );
});
