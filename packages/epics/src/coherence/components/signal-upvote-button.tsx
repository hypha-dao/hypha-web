'use client';

import React from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import {
  applyPendingSignalUpvotes,
  resolveSignalVoteAction,
  signalUpvoteCellMeasure,
  useCoherenceUpvoteMutations,
  useJwt,
  type CoherenceUpvoteSummary,
  type SignalSort,
  type SignalUpvoteSummaryState,
  type SignalVoteDirection,
  type SignalVotingMode,
} from '@hypha-platform/core/client';
import { Button, PopoverContent, Separator, Slider } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useSpaceAccentPortalStyles } from '../../spaces/components/space-accent-portal-context';
import {
  formatVotingPowerCompact,
  formatVotingPowerExact,
} from '../utils/format-voting-power';
import { SignalUpvoteCellChrome } from './signal-upvote-cell';
import { isArchivedSignalVoteError } from '../lib/signal-upvote-errors';
import type { SignalVotingModeStatus } from '../hooks/use-signal-voting-mode';
import {
  SignalVoteRoster,
  SignalVoteTotals,
  useSignalSpaceSlug,
} from './signal-vote-summary';

const MEMBERSHIP_ERROR_PATTERN = /space member or delegate/i;

export { isArchivedSignalVoteError };

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

function allocationAmount(
  summary: CoherenceUpvoteSummary,
  percent: number,
  locale: string,
): string | null {
  const max = summary.myUpvote?.maxVotingPower;
  if (!max) return null;
  try {
    const units = BigInt(max);
    if (units <= 0n) return null;
    const share = (units * BigInt(percent)) / 100n;
    return formatVotingPowerCompact(
      share.toString(),
      summary.tokenDecimals,
      locale,
    );
  } catch {
    return null;
  }
}

export {
  SignalUpvoteCellChrome,
  SignalUpvoteTriangle,
} from './signal-upvote-cell';

type SignalUpvoteButtonProps = {
  slug?: string | null;
  /** Space whose signal lists should show this vote without a reload. */
  spaceSlug?: string | null;
  upvotes?: CoherenceUpvoteSummary;
  /** `null` while the space's voting method is loading; voting stays closed. */
  votingMode: SignalVotingMode | null;
  /**
   * `error` offers a retry; `unavailable` means the space has no on-chain
   * voting, so the panel explains that instead of waiting forever.
   */
  votingModeStatus?: SignalVotingModeStatus;
  onRetryVotingMode?: () => void;
  /** Signed in, but not a member or delegate of the signal's space. */
  isNonMember?: boolean;
  /** Membership is still resolving; voting waits rather than risk a rejection. */
  isMembershipPending?: boolean;
  refresh?: () => Promise<unknown>;
  disabled?: boolean;
  /** Archived signals stay visible, but voting is closed. */
  archived?: boolean;
  /**
   * Kept so list and detail share one control. Layout does not change with it.
   * `top-power` shows the all-time token total; every other sort shows the
   * all-time voter count. The list time window does not change the figure.
   */
  variant?: 'feed' | 'page';
  sort?: SignalSort;
  /**
   * `ready` is a settled list, including a cached one. A missing summary is
   * then zero. `loading` keeps the ellipsis. `error` must not display as zero.
   */
  summaryState?: SignalUpvoteSummaryState;
  className?: string;
};

/**
 * Up and down on one pill. The number is the net. In a token-voting space,
 * an arrow opens a slider for that direction; confirming casts the partial
 * allocation. One member, one vote toggles on the arrow. The number opens
 * the up/down breakdown.
 */
export function SignalUpvoteButton({
  slug,
  spaceSlug,
  upvotes,
  votingMode,
  votingModeStatus = 'loading',
  onRetryVotingMode,
  isNonMember = false,
  isMembershipPending = false,
  refresh,
  disabled = false,
  archived = false,
  variant = 'feed',
  sort = 'top-voters',
  summaryState = 'ready',
  className,
}: SignalUpvoteButtonProps) {
  const t = useTranslations('SignalCard');
  const locale = useLocale();
  const format = useFormatter();
  const { jwt } = useJwt();
  const resolvedSpaceSlug = useSignalSpaceSlug(spaceSlug);
  const spaceAccentPortalStyle = useSpaceAccentPortalStyles();
  const { upvote, removeUpvote, isUpvoting, isRemovingUpvote } =
    useCoherenceUpvoteMutations(jwt);

  const [localSummary, setLocalSummary] =
    React.useState<CoherenceUpvoteSummary | null>(null);
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [rejectedAsNonMember, setRejectedAsNonMember] = React.useState(false);

  React.useEffect(() => {
    setLocalSummary(null);
  }, [upvotes]);

  // A server rejection only holds for the membership it was judged against.
  React.useEffect(() => {
    setRejectedAsNonMember(false);
  }, [isNonMember, isMembershipPending, jwt, slug]);

  const summary = localSummary ?? upvotes ?? EMPTY_SUMMARY;
  const direction: SignalVoteDirection | null = summary.myUpvote
    ? summary.myUpvote.direction === 'down'
      ? 'down'
      : 'up'
    : null;
  const hasVoted = direction != null;
  const isMutating = isUpvoting || isRemovingUpvote;
  const isVotingModeResolved = votingMode != null;
  const showVotingModeError =
    !isVotingModeResolved && votingModeStatus === 'error';
  const showVotingUnavailable =
    !isVotingModeResolved && votingModeStatus === 'unavailable';
  const canOpen =
    archived ||
    isVotingModeResolved ||
    showVotingModeError ||
    showVotingUnavailable;
  const isBlockedNonMember =
    Boolean(jwt) && (isNonMember || rejectedAsNonMember);
  const canVote =
    Boolean(slug?.trim()) &&
    Boolean(jwt) &&
    !archived &&
    !disabled &&
    !isBlockedNonMember &&
    !isMembershipPending &&
    isVotingModeResolved;
  const isOneMemberOneVote = votingMode === 'one-member-one-vote';
  const [percent, setPercent] = React.useState(() => myUpvotePercent(summary));

  const totalLabel = isOneMemberOneVote
    ? format.number(summary.netVoteCount)
    : formatVotingPowerCompact(
        summary.totalVotingPower,
        summary.tokenDecimals,
        locale,
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

  const run = React.useCallback(
    async (action: () => Promise<CoherenceUpvoteSummary | undefined>) => {
      if (!canVote || isMutating) return false;
      setError(null);
      try {
        const next = await action();
        if (next) {
          await applyResult(next);
          return true;
        }
        return false;
      } catch (err) {
        console.warn('Could not update signal upvote:', err);
        if (
          err instanceof Error &&
          MEMBERSHIP_ERROR_PATTERN.test(err.message)
        ) {
          setRejectedAsNonMember(true);
          return false;
        }
        if (isArchivedSignalVoteError(err)) {
          setError(t('upvoteArchived'));
          return false;
        }
        setError(t('upvoteFailed'));
        return false;
      }
    },
    [applyResult, canVote, isMutating, t],
  );

  const trimmedSlug = slug?.trim() ?? '';
  const allocatesPower = votingMode != null && !isOneMemberOneVote;
  const [allocationDirection, setAllocationDirection] =
    React.useState<SignalVoteDirection | null>(null);
  const handleDirection = (clicked: SignalVoteDirection) =>
    run(() => {
      const action = resolveSignalVoteAction(direction, clicked);
      if (action === 'remove') return removeUpvote({ slug: trimmedSlug });
      return upvote({
        slug: trimmedSlug,
        direction: action,
      });
    });
  const openAllocation = (clicked: SignalVoteDirection) => {
    setOpen(false);
    setError(null);
    setPercent(direction === clicked ? myUpvotePercent(summary) : 100);
    setAllocationDirection((current) => (current === clicked ? null : clicked));
  };
  const handleArrow = (clicked: SignalVoteDirection) => {
    if (allocatesPower) {
      openAllocation(clicked);
      return;
    }
    void handleDirection(clicked);
  };
  const handleConfirmAllocation = () => {
    if (!allocationDirection) return;
    const clicked = allocationDirection;
    void run(() =>
      upvote({
        slug: trimmedSlug,
        direction: clicked,
        votingPowerPercent: percent,
      }),
    ).then((ok) => {
      if (ok) setAllocationDirection(null);
    });
  };
  const handleRemove = () =>
    void run(() => removeUpvote({ slug: trimmedSlug })).then((ok) => {
      if (ok) {
        setOpen(false);
        setAllocationDirection(null);
      }
    });

  const stopPropagation = React.useCallback(
    (event: React.SyntheticEvent) => event.stopPropagation(),
    [],
  );

  const cellMeasure = signalUpvoteCellMeasure({
    sort,
    upvotes: localSummary ?? upvotes ?? null,
    summaryState,
  });
  const figureLabel =
    cellMeasure.kind === 'loading'
      ? '…'
      : cellMeasure.kind === 'error'
      ? '—'
      : cellMeasure.kind === 'count'
      ? format.number(cellMeasure.count)
      : formatVotingPowerCompact(
          cellMeasure.raw,
          cellMeasure.tokenDecimals,
          locale,
        );
  const exactLabel =
    cellMeasure.kind === 'power'
      ? formatVotingPowerExact(
          cellMeasure.raw,
          cellMeasure.tokenDecimals,
          locale,
        )
      : cellMeasure.kind === 'count'
      ? format.number(cellMeasure.count)
      : figureLabel;
  const upLabel = allocatesPower
    ? direction === 'up'
      ? t('updateVote')
      : t('upvote')
    : direction === 'up'
    ? t('removeUpvote')
    : t('upvote');
  const downLabel = allocatesPower
    ? direction === 'down'
      ? t('updateVote')
      : t('downvote')
    : direction === 'down'
    ? t('removeDownvote')
    : t('downvote');
  const chosenAmount = allocationAmount(summary, percent, locale);
  const allocationLabel =
    allocationDirection === 'down'
      ? t('downvoteWithVotingPower')
      : t('upvoteWithVotingPower');

  return (
    <div
      className={cn('inline-flex shrink-0 items-center', className)}
      onClick={stopPropagation}
      onKeyDown={stopPropagation}
    >
      <SignalUpvoteCellChrome
        figure={figureLabel}
        exactLabel={exactLabel}
        pressed={hasVoted}
        direction={direction}
        upLabel={upLabel}
        downLabel={downLabel}
        figureLabel={`${t('votes')} · ${exactLabel}`}
        voteDisabled={!canVote || isMutating}
        onVoteUp={() => handleArrow('up')}
        onVoteDown={() => handleArrow('down')}
        detailsOpen={open && canOpen}
        onDetailsOpenChange={(next) => {
          if (next && !canOpen) return;
          setOpen(next);
          if (next) {
            setAllocationDirection(null);
            setError(null);
          }
        }}
        allocationDirection={allocationDirection}
        onAllocationClose={() => setAllocationDirection(null)}
        allocationPanel={
          allocatesPower ? (
            <PopoverContent
              align="start"
              side="bottom"
              sideOffset={6}
              collisionPadding={12}
              data-testid="signal-vote-allocation"
              className="w-[min(16rem,calc(100vw-2rem))] rounded-none border border-border/80 bg-background-2 p-3 shadow-md"
              style={spaceAccentPortalStyle}
              data-space-accent-scope
              onClick={stopPropagation}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-1 text-foreground">
                    {allocationLabel}
                  </span>
                  <label className="inline-flex items-center gap-1 text-1 font-semibold tabular-nums text-foreground">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={100}
                      step={1}
                      value={percent}
                      disabled={isMutating}
                      aria-label={t('votingPowerPercent')}
                      data-testid="signal-vote-percent"
                      className="h-7 w-14 border border-border bg-transparent px-1 text-right text-1 tabular-nums text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      onChange={(event) => {
                        const raw = event.target.value;
                        if (raw.trim() === '') return;
                        const next = Number(raw);
                        if (!Number.isFinite(next)) return;
                        setPercent(
                          Math.min(100, Math.max(1, Math.round(next))),
                        );
                      }}
                    />
                    <span aria-hidden>%</span>
                  </label>
                </div>
                {chosenAmount ? (
                  <p className="m-0 text-1 tabular-nums text-muted-foreground">
                    {t('votingPowerAllocated', { amount: chosenAmount })}
                  </p>
                ) : null}
                <Slider
                  min={1}
                  max={100}
                  step={1}
                  value={[percent]}
                  onValueChange={(value) => setPercent(value[0] ?? 100)}
                  disabled={isMutating}
                  aria-label={allocationLabel}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    colorVariant="neutral"
                    size="sm"
                    disabled={isMutating}
                    data-testid="signal-vote-cancel"
                    onClick={() => setAllocationDirection(null)}
                  >
                    {t('cancelVote')}
                  </Button>
                  <Button
                    type="button"
                    colorVariant="accent"
                    size="sm"
                    disabled={isMutating}
                    data-testid="signal-vote-confirm"
                    onClick={handleConfirmAllocation}
                  >
                    {t('confirmVote')}
                  </Button>
                </div>
                {hasVoted ? (
                  <Button
                    type="button"
                    variant="ghost"
                    colorVariant="neutral"
                    size="sm"
                    className="w-full text-muted-foreground hover:text-foreground"
                    disabled={isMutating}
                    onClick={() => void handleRemove()}
                  >
                    {direction === 'down'
                      ? t('removeDownvote')
                      : t('removeUpvote')}
                  </Button>
                ) : null}
                {error ? (
                  <p
                    role="alert"
                    className="border border-error-6 bg-error-2 px-3 py-2 text-1 text-error-11"
                  >
                    {error}
                  </p>
                ) : null}
              </div>
            </PopoverContent>
          ) : undefined
        }
        aria-label={`${t('votes')} · ${exactLabel}`}
        aria-busy={!canOpen}
        data-upvote-variant={variant}
        data-upvote-measure={cellMeasure.kind}
        className={cn(
          (isMutating || !canOpen) && 'opacity-65',
          !canOpen && 'cursor-progress',
        )}
        detailsPanel={
          <PopoverContent
            align="start"
            side="bottom"
            collisionPadding={12}
            sideOffset={6}
            className="w-[min(18rem,calc(100vw-2rem))] rounded-none border border-border/80 bg-background-2 p-0 shadow-md"
            style={spaceAccentPortalStyle}
            data-space-accent-scope
            onClick={stopPropagation}
          >
            {archived ? (
              <p className="p-3 text-1 leading-relaxed text-muted-foreground">
                {t('upvoteArchived')}
              </p>
            ) : showVotingModeError ? (
              <div className="flex flex-col gap-3 p-3">
                <p
                  role="alert"
                  className="border border-error-6 bg-error-2 px-3 py-2 text-1 text-error-11"
                >
                  {t('votingModeLoadFailed')}
                </p>
                {onRetryVotingMode ? (
                  <Button
                    type="button"
                    variant="outline"
                    colorVariant="neutral"
                    size="sm"
                    className="w-full"
                    onClick={onRetryVotingMode}
                  >
                    {t('votingModeRetry')}
                  </Button>
                ) : null}
              </div>
            ) : showVotingUnavailable ? (
              <p className="p-3 text-1 leading-relaxed text-muted-foreground">
                {t('votingUnavailable')}
              </p>
            ) : (
              <div className="flex flex-col gap-3 p-3">
                <SignalVoteTotals
                  summary={summary}
                  totalLabel={totalLabel}
                  mode={isOneMemberOneVote ? 'count' : 'power'}
                />
                {isOneMemberOneVote ? (
                  <span className="-mt-2 text-1 text-muted-foreground">
                    {t('oneMemberOneVote')}
                  </span>
                ) : null}
                {!canVote ? (
                  <p className="text-1 leading-relaxed text-muted-foreground">
                    {isBlockedNonMember
                      ? t('upvoteMembersOnly')
                      : jwt && isMembershipPending
                      ? t('upvoteCheckingMembership')
                      : t('signInToUpvote')}
                  </p>
                ) : null}
                {error ? (
                  <p
                    role="alert"
                    className="border border-error-6 bg-error-2 px-3 py-2 text-1 text-error-11"
                  >
                    {error}
                  </p>
                ) : null}
                <Separator className="bg-border/70" />
                <SignalVoteRoster
                  summary={summary}
                  mode={isOneMemberOneVote ? 'count' : 'power'}
                  className="-mt-1"
                />
              </div>
            )}
          </PopoverContent>
        }
      />
    </div>
  );
}
