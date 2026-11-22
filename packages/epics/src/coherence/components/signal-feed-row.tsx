'use client';

import React from 'react';
import Link from 'next/link';
import { Clock, MessageSquare } from 'lucide-react';
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
  /**
   * Member list only. The existing upvote sits on the left and the signal
   * image, when there is one, sits on the right. Other personas keep the
   * current row.
   */
  memberLayout?: boolean;
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
  memberLayout = false,
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
  const comments = signalDiscussionCount(signal.messages, activity);
  const image = memberLayout ? signalListImage(signal) : null;
  const lastReply =
    activity?.lastReplyAt != null
      ? t('signalLastReply', {
          time: format.relativeTime(new Date(activity.lastReplyAt), now),
        })
      : activity?.reachesRoomStart
      ? t('signalNoReplies')
      : null;

  if (!memberLayout) {
    return (
      <article
        data-testid="signal-card"
        data-signal-slug={signal.slug ?? undefined}
        className="@container craft-card-interactive relative flex flex-col gap-1.5 p-4"
      >
        <div className="flex min-w-0 flex-col gap-1.5">
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
            <p className="mb-0 mt-1.5 truncate text-1 text-muted-foreground">
              {about}
            </p>
          ) : null}
          <div
            data-testid="signal-card-meta"
            className="mt-2.5 flex flex-wrap items-center gap-y-1.5 text-1 text-muted-foreground gap-x-[clamp(1.5rem,6cqi,5rem)] @min-[720px]:gap-x-[clamp(1.5rem,6vw,5rem)]"
          >
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
                className="relative z-10"
              />
            </ActionGate>
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

  return (
    <article
      data-testid="signal-card"
      data-signal-slug={signal.slug ?? undefined}
      data-member-signal-row=""
      className="@container craft-card-interactive relative flex flex-col gap-3 border-b border-border px-0 py-[18px]"
    >
      <div className="flex min-w-0 items-start gap-3.5">
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
          <SignalTypeBadge type={signal.type} />
          <h3
            className="m-0 text-[17px] font-semibold leading-[1.3] text-foreground max-md:text-[18px] max-md:font-normal"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            <Link
              href={href}
              className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
            >
              {signal.title}
            </Link>
          </h3>
          {about ? (
            <p className="mb-0 mt-1 line-clamp-2 text-[14px] leading-[1.55] text-muted-foreground max-md:text-[15px]">
              {about}
            </p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-1 text-muted-foreground">
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
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            data-testid="signal-card-image"
            className="h-[96px] w-[96px] shrink-0 self-start object-cover max-md:h-[72px] max-md:w-[72px]"
          />
        ) : null}
      </div>
    </article>
  );
}
