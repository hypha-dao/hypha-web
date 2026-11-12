'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import {
  applyPendingSignalUpvotes,
  resolveSignalVoteAction,
  useCoherenceUpvoteMutations,
  useJwt,
  type CoherenceUpvoteSummary,
  type SignalVoteDirection,
} from '@hypha-platform/core/client';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  Slider,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useSpaceAccentPortalStyles } from '../../spaces/components/space-accent-portal-context';
import { formatVotingPowerCompact } from '../utils/format-voting-power';
import { SignalUpvoteTriangle } from './signal-upvote-cell';
import {
  SignalVoteRoster,
  SignalVoteTotals,
  useSignalSpaceSlug,
} from './signal-vote-summary';

const EMPTY_SUMMARY: CoherenceUpvoteSummary = {
  totalVotingPower: '0',
  upvoteCount: 0,
  downvoteCount: 0,
  upVotingPower: '0',
  downVotingPower: '0',
  netVoteCount: 0,
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
  compact?: boolean;
  className?: string;
};

/**
 * Up/down pill plus a details popover. Clicking the selected direction clears
 * the vote; clicking the other direction switches. The number is the net.
 * The popover still allocates a share of voting power for the active direction.
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
  const resolvedSpaceSlug = useSignalSpaceSlug();
  const spaceAccentPortalStyle = useSpaceAccentPortalStyles();
  const { upvote, removeUpvote, isUpvoting, isRemovingUpvote } =
    useCoherenceUpvoteMutations(jwt);

  const [localSummary, setLocalSummary] =
    React.useState<CoherenceUpvoteSummary | null>(null);
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Drop the optimistic overlay whenever the parent delivers fresh upvote
  // data (refresh() or another member's vote), so the prop wins again.
  React.useEffect(() => {
    setLocalSummary(null);
  }, [upvotes]);

  const summary = localSummary ?? upvotes ?? EMPTY_SUMMARY;
  const direction: SignalVoteDirection | null = summary.myUpvote
    ? summary.myUpvote.direction === 'down'
      ? 'down'
      : 'up'
    : null;
  const hasVoted = direction != null;
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
      const signalSlug = slug?.trim();
      if (resolvedSpaceSlug && signalSlug) {
        applyPendingSignalUpvotes(resolvedSpaceSlug, signalSlug, next);
      }
      try {
        await refresh?.();
      } catch {
        // The feed cache already has this vote. A refetch is best-effort.
      }
    },
    [refresh, resolvedSpaceSlug, slug],
  );

  const handleDirection = React.useCallback(
    async (clicked: SignalVoteDirection) => {
      const trimmedSlug = slug?.trim();
      if (!trimmedSlug || !canVote || isMutating) return;
      setError(null);
      try {
        const action = resolveSignalVoteAction(direction, clicked);
        const next =
          action === 'remove'
            ? await removeUpvote({ slug: trimmedSlug })
            : await upvote({
                slug: trimmedSlug,
                direction: action,
                votingPowerPercent: percent,
              });
        if (next) await applyResult(next);
      } catch (err) {
        console.warn('Could not update signal vote:', err);
        setError(t('upvoteFailed'));
      }
    },
    [
      applyResult,
      canVote,
      direction,
      isMutating,
      percent,
      removeUpvote,
      slug,
      t,
      upvote,
    ],
  );

  const handleApplyPercent = React.useCallback(async () => {
    const trimmedSlug = slug?.trim();
    if (!trimmedSlug || !canVote || isMutating) return;
    setError(null);
    try {
      const next = await upvote({
        slug: trimmedSlug,
        votingPowerPercent: percent,
        direction: direction ?? 'up',
      });
      if (next) {
        setPopoverOpen(false);
        await applyResult(next);
      }
    } catch (err) {
      console.warn('Could not update signal upvote:', err);
      setError(t('upvoteFailed'));
    }
  }, [applyResult, canVote, direction, isMutating, percent, slug, t, upvote]);

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

  // Button size="sm" sets min-h-8; zero it so our pill height wins.
  const pillHeightClass = cn('min-h-0 shrink-0 py-0', compact ? 'h-5' : 'h-6');
  const iconSizeClass = compact ? 'h-2.5 w-2.5' : 'h-3 w-3';
  const hasAnyVotes = summary.upvoteCount + summary.downvoteCount > 0;

  return (
    <div
      className={cn('flex shrink-0 items-center', className)}
      onClick={stopPropagation}
      onKeyDown={stopPropagation}
    >
      <div
        className={cn(
          'group/upvote inline-flex items-stretch overflow-hidden rounded-full border transition-[border-color,background-color,opacity] duration-200 ease-out',
          pillHeightClass,
          direction === 'down' || direction === 'up'
            ? 'border-accent-8/80 bg-background/60'
            : 'border-border/75 bg-background/55 hover:border-border hover:bg-muted/25',
          isMutating && 'pointer-events-none opacity-65',
          !canVote && 'opacity-55',
        )}
      >
        <Button
          type="button"
          variant="ghost"
          colorVariant="neutral"
          size="sm"
          className={cn(
            pillHeightClass,
            'w-6 rounded-none border-0 px-0 shadow-none ring-0 hover:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0',
            direction === 'up'
              ? 'bg-accent-9 text-accent-contrast hover:bg-accent-10'
              : 'text-muted-foreground hover:bg-muted/35 hover:text-foreground',
          )}
          disabled={!canVote || isMutating}
          aria-pressed={direction === 'up'}
          aria-label={direction === 'up' ? t('removeUpvote') : t('upvote')}
          title={
            !jwt
              ? t('signInToUpvote')
              : direction === 'up'
              ? t('removeUpvote')
              : t('upvote')
          }
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void handleDirection('up');
          }}
        >
          <SignalUpvoteTriangle className={iconSizeClass} />
        </Button>
        <span
          className={cn(
            'flex items-center px-1.5 tabular-nums',
            compact ? 'text-[10px]' : 'text-[11px]',
            direction === 'down' || direction === 'up'
              ? 'font-semibold text-accent-11'
              : hasAnyVotes
              ? 'font-medium text-foreground'
              : 'font-medium text-muted-foreground',
          )}
          title={`${t('net')} ${totalLabel}`}
        >
          {totalLabel}
        </span>
        <Button
          type="button"
          variant="ghost"
          colorVariant="neutral"
          size="sm"
          className={cn(
            pillHeightClass,
            'w-6 rounded-none border-0 px-0 shadow-none ring-0 hover:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0',
            direction === 'down'
              ? 'bg-accent-9 text-accent-contrast hover:bg-accent-10'
              : 'text-muted-foreground hover:bg-muted/35 hover:text-foreground',
          )}
          disabled={!canVote || isMutating}
          aria-pressed={direction === 'down'}
          aria-label={
            direction === 'down' ? t('removeDownvote') : t('downvote')
          }
          title={
            !jwt
              ? t('signInToUpvote')
              : direction === 'down'
              ? t('removeDownvote')
              : t('downvote')
          }
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void handleDirection('down');
          }}
        >
          <SignalUpvoteTriangle className={cn(iconSizeClass, 'rotate-180')} />
        </Button>
        <span
          className="my-1 w-px shrink-0 self-stretch bg-border/80"
          aria-hidden
        />
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
              variant="ghost"
              colorVariant="neutral"
              size="sm"
              className={cn(
                pillHeightClass,
                compact ? 'w-5' : 'w-6',
                'flex items-center justify-center rounded-none border-0 px-0 text-muted-foreground shadow-none ring-0 hover:bg-muted/35 hover:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:bg-muted/45 data-[state=open]:text-foreground',
                hasVoted && 'text-accent-11 hover:text-accent-11',
              )}
              aria-haspopup="dialog"
              aria-label={t('upvoteDetails')}
              title={t('upvoteDetails')}
              onClick={stopPropagation}
            >
              <ChevronDown
                className={cn(
                  iconSizeClass,
                  'transition-transform duration-200',
                  popoverOpen && 'rotate-180',
                )}
                aria-hidden
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            sideOffset={8}
            className="w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border/90 bg-background-2 p-0 shadow-md"
            style={spaceAccentPortalStyle}
            data-space-accent-scope
            onClick={stopPropagation}
          >
            <div className="flex flex-col">
              <div className="flex flex-col gap-2 px-4 py-3.5">
                <SignalVoteTotals
                  summary={summary}
                  totalLabel={totalLabel}
                  mode="power"
                />
              </div>

              {canVote ? (
                <>
                  <Separator className="bg-border/70" />
                  <div className="flex flex-col gap-4 px-4 py-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-1 font-medium text-foreground">
                          {direction === 'down'
                            ? t('downvoteWithVotingPower')
                            : t('yourVotingPowerShare')}
                        </span>
                        <span className="text-1 font-semibold tabular-nums text-accent-11">
                          {percent}%
                        </span>
                      </div>
                      <Slider
                        min={1}
                        max={100}
                        step={1}
                        value={[percent]}
                        onValueChange={(value) => setPercent(value[0] ?? 100)}
                        disabled={isMutating}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        type="button"
                        colorVariant="accent"
                        className="w-full gap-2"
                        disabled={isMutating}
                        onClick={() => void handleApplyPercent()}
                      >
                        <SignalUpvoteTriangle
                          className={cn(
                            'h-4 w-4',
                            direction === 'down' && 'rotate-180',
                          )}
                        />
                        {hasVoted ? t('updateUpvote') : t('upvote')}
                      </Button>
                      {hasVoted ? (
                        <Button
                          type="button"
                          variant="ghost"
                          colorVariant="neutral"
                          className="w-full text-muted-foreground hover:text-foreground"
                          disabled={isMutating}
                          onClick={() => void handleRemove()}
                        >
                          {t('removeUpvote')}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Separator className="bg-border/70" />
                  <p className="px-4 py-4 text-1 leading-relaxed text-muted-foreground">
                    {t('signInToUpvote')}
                  </p>
                </>
              )}

              {error ? (
                <p
                  role="alert"
                  className="mx-4 mb-4 rounded-lg border border-error-6 bg-error-2 px-3 py-2 text-1 text-error-11"
                >
                  {error}
                </p>
              ) : null}

              <Separator className="bg-border/70" />
              <div className="flex flex-col gap-3 px-4 py-3.5">
                <SignalVoteRoster summary={summary} mode="power" />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
