'use client';

import React from 'react';
import Link from 'next/link';
import { Clock, MessageSquare } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import type { Coherence, SignalVotingMode } from '@hypha-platform/core/client';
import { cn, stripDescription, stripMarkdown } from '@hypha-platform/ui-utils';
import { SignalTypeBadge } from './signal-type-badge';
import { SignalUpvoteButton } from './signal-upvote-button';
import { SignalMediaChips } from './signal-media-chips';
import { countSignalMedia } from '../utils/signal-media';
import type { SignalRoomActivity } from '../hooks/use-signal-room-activity';
import type { SignalVotingModeStatus } from '../hooks/use-signal-voting-mode';

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

type SignalFeedRowProps = {
  signal: Coherence;
  href: string;
  votingMode: SignalVotingMode | null;
  votingModeStatus?: SignalVotingModeStatus;
  onRetryVotingMode?: () => void;
  isNonMember?: boolean;
  isMembershipPending?: boolean;
  activity?: SignalRoomActivity;
  refresh?: () => Promise<unknown>;
};

export function SignalFeedRow({
  signal,
  href,
  votingMode,
  votingModeStatus,
  onRetryVotingMode,
  isNonMember,
  isMembershipPending,
  activity,
  refresh,
}: SignalFeedRowProps) {
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
  const storedComments = signal.messages ?? 0;
  const comments = activity
    ? activity.reachesRoomStart
      ? activity.comments
      : Math.max(activity.comments, storedComments)
    : storedComments;
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
      className="craft-card-interactive relative flex items-start gap-4 p-4"
    >
      <SignalUpvoteButton
        slug={signal.slug}
        upvotes={signal.upvotes}
        votingMode={votingMode}
        votingModeStatus={votingModeStatus}
        onRetryVotingMode={onRetryVotingMode}
        isNonMember={isNonMember}
        isMembershipPending={isMembershipPending}
        refresh={refresh}
        className="relative z-10"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <SignalTypeBadge type={signal.type} />
        <h3 className="m-0 truncate text-3 font-medium leading-snug text-foreground">
          <Link
            href={href}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {signal.title}
          </Link>
        </h3>
        {about ? (
          <p className="m-0 truncate text-1 text-muted-foreground">{about}</p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-1 text-muted-foreground">
          {created ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="craft-icon-sm" aria-hidden />
              {t('signalCreated', { date: created })}
            </span>
          ) : null}
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
    </article>
  );
}
