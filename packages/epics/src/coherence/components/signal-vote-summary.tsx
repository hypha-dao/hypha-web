'use client';

import React from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import type { CoherenceUpvoteSummary } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { PersonAvatar } from '../../people/components/person-avatar';
import { formatVotingPowerCompact } from '../utils/format-voting-power';

export function useSignalSpaceSlug(explicit?: string | null): string {
  const params = useParams<{ id?: string | string[] }>();
  const fromParam = Array.isArray(params?.id) ? params.id[0] : params?.id;
  return explicit?.trim() || fromParam?.trim() || '';
}

type VoteSummaryMode = 'count' | 'power';

function useVoteSideLabels(
  summary: CoherenceUpvoteSummary,
  mode: VoteSummaryMode,
) {
  const t = useTranslations('SignalCard');
  const locale = useLocale();
  const format = useFormatter();
  const upCount = format.number(summary.upvoteCount);
  const downCount = format.number(summary.downvoteCount);
  const upPower = formatVotingPowerCompact(
    summary.upVotingPower,
    summary.tokenDecimals,
    locale,
  );
  const downPower = formatVotingPowerCompact(
    summary.downVotingPower,
    summary.tokenDecimals,
    locale,
  );
  return {
    t,
    locale,
    upLabel:
      mode === 'count'
        ? t('upVotesCount', { count: upCount })
        : t('upVotesPower', { count: upCount, power: upPower }),
    downLabel:
      mode === 'count'
        ? t('downVotesCount', { count: downCount })
        : t('downVotesPower', { count: downCount, power: downPower }),
  };
}

/** Net header plus the up and down sides. */
export function SignalVoteTotals({
  summary,
  totalLabel,
  mode,
}: {
  summary: CoherenceUpvoteSummary;
  totalLabel: string;
  mode: VoteSummaryMode;
}) {
  const { t, upLabel, downLabel } = useVoteSideLabels(summary, mode);
  return (
    <>
      <div
        className="flex items-center justify-between gap-3"
        data-testid="signal-votes-total"
      >
        <span className="text-1 text-muted-foreground">{t('votes')}</span>
        <span className="text-3 font-semibold tabular-nums text-foreground">
          {totalLabel}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 text-1">
        <span className="text-accent-11" data-testid="signal-votes-up">
          {upLabel}
        </span>
        <span className="text-error-11" data-testid="signal-votes-down">
          {downLabel}
        </span>
      </div>
    </>
  );
}

/** Voter rows marked up or down, or the empty state when nobody has voted. */
export function SignalVoteRoster({
  summary,
  mode,
  className,
}: {
  summary: CoherenceUpvoteSummary;
  mode: VoteSummaryMode;
  className?: string;
}) {
  const { t, locale } = useVoteSideLabels(summary, mode);
  if (summary.voters.length === 0) {
    return (
      <span
        className="text-1 text-muted-foreground"
        data-testid="signal-votes-empty"
      >
        {t('noVotesYet')}
      </span>
    );
  }

  return (
    <ul
      className={cn(
        'flex max-h-48 flex-col gap-1.5 overflow-y-auto narrow-scrollbar',
        className,
      )}
    >
      {summary.voters.map((voter) => {
        const direction = voter.direction === 'down' ? 'down' : 'up';
        const down = direction === 'down';
        return (
          <li
            key={voter.personId}
            className="flex items-center justify-between gap-2 border border-border/70 px-2.5 py-2"
            data-testid="signal-voter-row"
            data-vote-direction={direction}
          >
            <span className="flex min-w-0 items-center gap-2">
              <PersonAvatar
                size="sm"
                shape="circle"
                avatarSrc={voter.avatarUrl ?? ''}
                userName={voter.name ?? undefined}
                personId={voter.personId}
              />
              <span className="truncate text-1 text-foreground">
                {voter.name || t('anonymousSupporter')}
              </span>
              <span
                className={cn(
                  'shrink-0 text-1',
                  down ? 'text-error-11' : 'text-accent-11',
                )}
                data-testid="signal-voter-direction"
              >
                {down ? t('voteDown') : t('voteUp')}
              </span>
            </span>
            <span
              className={cn(
                'shrink-0 text-1 tabular-nums',
                down ? 'text-error-11' : 'text-muted-foreground',
              )}
            >
              {down ? '−' : ''}
              {mode === 'count'
                ? t('votesCount', { count: 1 })
                : formatVotingPowerCompact(
                    voter.votingPower,
                    summary.tokenDecimals,
                    locale,
                  )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
