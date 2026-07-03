'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowBigUp, ChevronDown } from 'lucide-react';
import {
  useCoherenceUpvoteMutations,
  useJwt,
  type CoherenceUpvoteSummary,
} from '@hypha-platform/core/client';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Slider,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { PersonAvatar } from '../../people/components/person-avatar';
import { useSpaceAccentPortalStyles } from '../../spaces/components/space-accent-portal-context';
import { formatVotingPowerCompact } from '../utils/format-voting-power';

const EMPTY_SUMMARY: CoherenceUpvoteSummary = {
  totalVotingPower: '0',
  upvoteCount: 0,
  tokenDecimals: 0,
  voters: [],
  myUpvote: null,
};

function myUpvotePercent(summary: CoherenceUpvoteSummary): number {
  const myUpvote = summary.myUpvote;
  if (!myUpvote) return 100;
  try {
    const max = BigInt(myUpvote.maxVotingPower);
    if (max <= 0n) return 100;
    const percent = Number((BigInt(myUpvote.votingPower) * 100n) / max);
    return Math.min(100, Math.max(1, percent));
  } catch {
    return 100;
  }
}

type SignalUpvoteControlProps = {
  slug?: string | null;
  upvotes?: CoherenceUpvoteSummary;
  refresh?: () => Promise<void>;
  disabled?: boolean;
  /** Smaller pill for dense task cards. */
  compact?: boolean;
  className?: string;
};

/**
 * Upvote pill + details popover for a signal. The pill toggles an upvote at
 * full voting power; the popover lets the user fine-tune the share of voting
 * power, remove the upvote, and see who has voted.
 */
export function SignalUpvoteControl({
  slug,
  upvotes,
  refresh,
  disabled = false,
  compact = false,
  className,
}: SignalUpvoteControlProps) {
  const t = useTranslations('SignalCard');
  const locale = useLocale();
  const { jwt } = useJwt();
  const spaceAccentPortalStyle = useSpaceAccentPortalStyles();
  const { upvote, removeUpvote, isUpvoting, isRemovingUpvote } =
    useCoherenceUpvoteMutations(jwt);

  const [localSummary, setLocalSummary] =
    React.useState<CoherenceUpvoteSummary | null>(null);
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const summary = localSummary ?? upvotes ?? EMPTY_SUMMARY;
  const hasVoted = summary.myUpvote != null;
  const isMutating = isUpvoting || isRemovingUpvote;
  const canVote = Boolean(slug?.trim()) && Boolean(jwt) && !disabled;

  const [percent, setPercent] = React.useState(() => myUpvotePercent(summary));

  const totalLabel = React.useMemo(
    () =>
      formatVotingPowerCompact(
        summary.totalVotingPower,
        summary.tokenDecimals,
        locale,
      ),
    [summary.totalVotingPower, summary.tokenDecimals, locale],
  );

  const applyResult = React.useCallback(
    async (next: CoherenceUpvoteSummary) => {
      setLocalSummary(next);
      setPercent(myUpvotePercent(next));
      try {
        await refresh?.();
      } catch {
        // Ranking refresh is best-effort; the local summary is already current.
      }
    },
    [refresh],
  );

  const handleToggle = React.useCallback(async () => {
    const trimmedSlug = slug?.trim();
    if (!trimmedSlug || !canVote || isMutating) return;
    setError(null);
    try {
      const next = hasVoted
        ? await removeUpvote({ slug: trimmedSlug })
        : await upvote({ slug: trimmedSlug });
      if (next) await applyResult(next);
    } catch (err) {
      console.warn('Could not toggle signal upvote:', err);
      setError(t('upvoteFailed'));
    }
  }, [
    applyResult,
    canVote,
    hasVoted,
    isMutating,
    removeUpvote,
    slug,
    t,
    upvote,
  ]);

  const handleApplyPercent = React.useCallback(async () => {
    const trimmedSlug = slug?.trim();
    if (!trimmedSlug || !canVote || isMutating) return;
    setError(null);
    try {
      const next = await upvote({
        slug: trimmedSlug,
        votingPowerPercent: percent,
      });
      if (next) {
        setPopoverOpen(false);
        await applyResult(next);
      }
    } catch (err) {
      console.warn('Could not update signal upvote:', err);
      setError(t('upvoteFailed'));
    }
  }, [applyResult, canVote, isMutating, percent, slug, t, upvote]);

  const handleRemove = React.useCallback(async () => {
    const trimmedSlug = slug?.trim();
    if (!trimmedSlug || !canVote || isMutating) return;
    setError(null);
    try {
      const next = await removeUpvote({ slug: trimmedSlug });
      if (next) {
        setPopoverOpen(false);
        await applyResult(next);
      }
    } catch (err) {
      console.warn('Could not remove signal upvote:', err);
      setError(t('upvoteFailed'));
    }
  }, [applyResult, canVote, isMutating, removeUpvote, slug, t]);

  const stopPropagation = React.useCallback(
    (e: React.SyntheticEvent) => e.stopPropagation(),
    [],
  );

  // Button size="sm" sets min-h-8; zero it so the compact heights apply.
  const pillHeightClass = cn('min-h-0 py-0', compact ? 'h-5' : 'h-6');
  const hasAnyVotes = summary.upvoteCount > 0;

  return (
    <div
      className={cn('flex shrink-0 items-center', className)}
      onClick={stopPropagation}
      onKeyDown={stopPropagation}
    >
      <Button
        type="button"
        variant="outline"
        colorVariant={hasVoted ? 'accent' : 'neutral'}
        size="sm"
        className={cn(
          pillHeightClass,
          'gap-1 rounded-r-none border-r-0 tabular-nums',
          hasAnyVotes ? 'px-2' : 'w-8 justify-center px-0',
          hasVoted
            ? 'bg-accent-3/40 text-accent-11 hover:bg-accent-3/60'
            : 'bg-transparent text-muted-foreground hover:text-foreground',
        )}
        disabled={!canVote || isMutating}
        aria-pressed={hasVoted}
        aria-label={hasVoted ? t('removeUpvote') : t('upvote')}
        title={
          !jwt
            ? t('signInToUpvote')
            : hasVoted
            ? t('removeUpvote')
            : t('upvote')
        }
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void handleToggle();
        }}
      >
        <ArrowBigUp
          className={cn(
            compact ? 'h-3 w-3' : 'h-3.5 w-3.5',
            hasVoted && 'fill-current',
          )}
          aria-hidden
        />
        <span className={compact ? 'text-[11px]' : 'text-1'}>{totalLabel}</span>
      </Button>
      <Popover
        open={popoverOpen}
        onOpenChange={(open) => {
          setPopoverOpen(open);
          if (open) {
            setPercent(myUpvotePercent(summary));
            setError(null);
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            colorVariant="neutral"
            size="sm"
            className={cn(
              pillHeightClass,
              'w-8 rounded-l-none px-0 text-muted-foreground hover:text-foreground',
            )}
            aria-haspopup="dialog"
            aria-label={t('upvoteDetails')}
            title={t('upvoteDetails')}
            onClick={stopPropagation}
          >
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-72 p-4"
          style={spaceAccentPortalStyle}
          onClick={stopPropagation}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-1 font-medium text-muted-foreground">
                {t('totalSupport')}
              </span>
              <span className="text-2 font-semibold tabular-nums">
                {totalLabel}
              </span>
            </div>

            {canVote ? (
              <div className="flex flex-col gap-2">
                <span className="text-1 text-muted-foreground">
                  {t('yourVotingPowerShare')}
                </span>
                <Slider
                  min={1}
                  max={100}
                  step={1}
                  value={[percent]}
                  onValueChange={(value) => setPercent(value[0] ?? 100)}
                  displayValue
                  disabled={isMutating}
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    colorVariant="accent"
                    size="sm"
                    className="h-7 flex-1"
                    disabled={isMutating}
                    onClick={() => void handleApplyPercent()}
                  >
                    {hasVoted ? t('updateUpvote') : t('upvote')}
                  </Button>
                  {hasVoted ? (
                    <Button
                      type="button"
                      variant="outline"
                      colorVariant="neutral"
                      size="sm"
                      className="h-7"
                      disabled={isMutating}
                      onClick={() => void handleRemove()}
                    >
                      {t('removeUpvote')}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-1 text-muted-foreground">
                {t('signInToUpvote')}
              </p>
            )}

            {error ? (
              <p role="alert" className="text-1 text-error-11">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-1.5 border-t border-border/60 pt-2.5">
              <span className="text-1 font-medium text-muted-foreground">
                {t('supportersCount', { count: summary.upvoteCount })}
              </span>
              {summary.voters.length === 0 ? null : (
                <ul className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
                  {summary.voters.map((voter) => (
                    <li
                      key={voter.personId}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <PersonAvatar
                          size="sm"
                          shape="circle"
                          avatarSrc={voter.avatarUrl ?? ''}
                          userName={voter.name ?? undefined}
                        />
                        <span className="truncate text-1">
                          {voter.name || t('anonymousSupporter')}
                        </span>
                      </span>
                      <span className="shrink-0 text-1 tabular-nums text-muted-foreground">
                        {formatVotingPowerCompact(
                          voter.votingPower,
                          summary.tokenDecimals,
                          locale,
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
