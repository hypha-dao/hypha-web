'use client';

import React from 'react';
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import type {
  Coherence,
  SignalSort,
  SignalUpvoteSummaryState,
  SignalVotingMode,
} from '@hypha-platform/core/client';
import { cn, stripDescription, stripMarkdown } from '@hypha-platform/ui-utils';
import { SignalTypeBadge } from './signal-type-badge';
import { SignalUpvoteButton } from './signal-upvote-button';
import { ActionGate } from '../../common/action-capabilities';
import { SignalMediaChips } from './signal-media-chips';
import { countSignalMedia, signalListImage } from '../utils/signal-media';
import type { SignalRoomActivity } from '../hooks/use-signal-room-activity';
import { signalDiscussionCount } from '../utils/signal-room-replies';
import type { SignalVotingModeStatus } from '../hooks/use-signal-voting-mode';
import { useSignalCreatorMeta } from '../hooks/use-signal-creator-meta';

export function signalOneLiner(description?: string | null): string {
  return stripDescription(
    stripMarkdown(description ?? '', {
      orderedListMarkers: false,
      unorderedListMarkers: false,
    }),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Oct 12", with the year once it is not the current one. */
export function useSignalShortDate() {
  const format = useFormatter();
  return React.useCallback(
    (value: Date | string | null | undefined) => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      const sameYear = date.getFullYear() === new Date().getFullYear();
      return format.dateTime(date, {
        month: 'short',
        day: 'numeric',
        ...(sameYear ? {} : { year: 'numeric' }),
      });
    },
    [format],
  );
}

export type SignalFeedItemProps = {
  signal: Coherence;
  spaceSlug: string;
  href: string;
  votingMode: SignalVotingMode | null;
  votingModeStatus?: SignalVotingModeStatus;
  onRetryVotingMode?: () => void;
  isNonMember?: boolean;
  isMembershipPending?: boolean;
  activity?: SignalRoomActivity;
  refresh?: () => Promise<unknown>;
  sort: SignalSort;
  summaryState?: SignalUpvoteSummaryState;
};

export function SignalFeedRow({
  signal,
  spaceSlug,
  href,
  votingMode,
  votingModeStatus,
  onRetryVotingMode,
  isNonMember,
  isMembershipPending,
  activity,
  refresh,
  sort,
  summaryState,
}: SignalFeedItemProps) {
  const t = useTranslations('CoherenceTab');
  const format = useFormatter();
  const now = useNow({ updateInterval: 60_000 });
  const shortDate = useSignalShortDate();

  const about = React.useMemo(
    () => signalOneLiner(signal.description),
    [signal.description],
  );
  const media = React.useMemo(() => countSignalMedia(signal), [signal]);
  const created = shortDate(signal.createdAt);
  const comments = signalDiscussionCount(signal.messages, activity);
  const image = signalListImage(signal);
  const { creatorDisplayName } = useSignalCreatorMeta({
    creatorId: signal.creatorId,
    createdAt: signal.createdAt,
    description: signal.description,
    title: signal.title,
    tags: signal.tags,
    origin: signal.origin,
  });
  const lastReply =
    activity?.lastReplyAt != null
      ? t('signalLastReply', {
          time: format.relativeTime(new Date(activity.lastReplyAt), now),
        })
      : activity?.reachesRoomStart
      ? t('signalNoReplies')
      : null;

  return (
    <article
      data-testid="signal-card"
      data-signal-slug={signal.slug ?? undefined}
      data-signal-layout="list"
      className="@container craft-card-interactive relative flex flex-col px-3.5 py-3.5"
    >
      <div className="flex min-w-0 items-center gap-4 md:gap-5">
        <div className="relative z-10 w-[56px] shrink-0">
          <ActionGate kind="upvote" fullAppPath="" label={null}>
            <SignalUpvoteButton
              slug={signal.slug}
              spaceSlug={spaceSlug}
              upvotes={signal.upvotes}
              votingMode={votingMode}
              votingModeStatus={votingModeStatus}
              onRetryVotingMode={onRetryVotingMode}
              isNonMember={isNonMember}
              isMembershipPending={isMembershipPending}
              refresh={refresh}
              archived={signal.archived}
              sort={sort}
              summaryState={summaryState}
              layout="stack"
              className="relative z-10 w-full"
            />
          </ActionGate>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="mb-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <SignalTypeBadge type={signal.type} />
            {creatorDisplayName || created ? (
              <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 text-[12px] text-muted-foreground">
                {creatorDisplayName ? (
                  <span className="truncate">{creatorDisplayName}</span>
                ) : null}
                {creatorDisplayName && created ? (
                  <span aria-hidden>·</span>
                ) : null}
                {created ? <span className="shrink-0">{created}</span> : null}
              </span>
            ) : null}
          </div>
          <h3 className="m-0 truncate text-[18px] font-medium leading-snug tracking-[-0.01em] text-foreground">
            <Link
              href={href}
              className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
            >
              {signal.title}
            </Link>
          </h3>
          {about ? (
            <p className="mb-0 mt-1 line-clamp-2 max-w-[52ch] text-1 leading-relaxed text-muted-foreground">
              {about}
            </p>
          ) : null}
          <div
            data-testid="signal-card-meta"
            className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-1 text-muted-foreground"
          >
            {lastReply ? (
              <span className="inline-flex items-center gap-1.5">
                <MessageSquare className="craft-icon-sm" aria-hidden />
                {lastReply}
              </span>
            ) : null}
            <span className={cn('tabular-nums')}>
              {t('signalCommentsCount', { count: comments })}
            </span>
            <SignalMediaChips counts={media} />
          </div>
        </div>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            data-testid="signal-card-image"
            className="h-[120px] w-[120px] shrink-0 object-cover max-md:h-[88px] max-md:w-[88px]"
          />
        ) : null}
      </div>
    </article>
  );
}
