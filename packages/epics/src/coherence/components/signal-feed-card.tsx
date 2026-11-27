'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  canonicalSignalType,
  COHERENCE_TYPES,
  COHERENCE_TYPE_OPTIONS,
} from '@hypha-platform/core/client';
import { SignalDomainControl } from './signal-domain';
import { signalOneLiner, type SignalFeedItemProps } from './signal-feed-row';
import { SignalUpvoteButton } from './signal-upvote-button';
import { ActionGate } from '../../common/action-capabilities';
import { signalListImage } from '../utils/signal-media';

function SignalCardTypeLabel({ type }: { type?: string | null }) {
  const t = useTranslations('CoherenceTab');
  const value = canonicalSignalType(type);
  if (!value || !(COHERENCE_TYPES as readonly string[]).includes(value)) {
    return null;
  }
  const option = COHERENCE_TYPE_OPTIONS.find((item) => item.type === value);
  if (!option) return null;
  const key = `types.${value}`;
  const label = t.has(key as never) ? t(key as never) : option.title;
  return (
    <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {label}
    </p>
  );
}

export function SignalFeedCard({
  signal,
  spaceSlug,
  href,
  votingMode,
  votingModeStatus,
  onRetryVotingMode,
  isNonMember,
  isMembershipPending,
  refresh,
  sort,
  summaryState,
  canEditDomain = false,
  spaceBanner,
}: SignalFeedItemProps) {
  const t = useTranslations('CoherenceTab');
  const about = React.useMemo(
    () => signalOneLiner(signal.description),
    [signal.description],
  );
  const image = signalListImage(signal, spaceBanner);

  return (
    <article
      data-testid="signal-card"
      data-signal-slug={signal.slug ?? undefined}
      data-signal-layout="cards"
      className="craft-card-interactive relative flex h-full min-w-0 flex-col"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-3">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            data-testid="signal-card-image"
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 pt-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <SignalCardTypeLabel type={signal.type} />
          <SignalDomainControl
            spaceSlug={spaceSlug}
            signalSlug={signal.slug}
            board={signal.board}
            editable={canEditDomain}
            refresh={refresh}
          />
        </div>
        <h3 className="m-0 text-[18px] font-medium leading-snug tracking-[-0.01em] text-foreground">
          <Link
            href={href}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {signal.title}
          </Link>
        </h3>
        {about ? (
          <p className="mb-0 line-clamp-3 text-1 leading-relaxed text-muted-foreground">
            {about}
          </p>
        ) : null}
      </div>
      <div className="relative z-10 mt-4 flex items-center gap-2 border-t border-border/70 px-4 py-3">
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
            layout="row"
            className="relative z-10"
          />
        </ActionGate>
        <Link
          href={href}
          data-testid="signal-card-open"
          className="relative z-10 ml-auto inline-flex h-7 min-h-0 shrink-0 items-center gap-1 border border-border bg-transparent px-3 text-1 font-medium leading-none text-foreground hover:bg-foreground/5"
        >
          {t('signalOpen')}
          <span aria-hidden>›</span>
        </Link>
      </div>
    </article>
  );
}
