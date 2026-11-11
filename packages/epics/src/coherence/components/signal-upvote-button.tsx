'use client';

import React from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import {
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
import {
  Button,
  Popover,
  PopoverAnchor,
  PopoverContent,
  Separator,
  Slider,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { PersonAvatar } from '../../people/components/person-avatar';
import { useSpaceAccentPortalStyles } from '../../spaces/components/space-accent-portal-context';
import {
  formatVotingPowerCompact,
  formatVotingPowerExact,
} from '../utils/format-voting-power';
import {
  SignalUpvoteCellChrome,
  SignalUpvoteTriangle,
} from './signal-upvote-cell';
import { isArchivedSignalVoteError } from '../lib/signal-upvote-errors';
import type { SignalVotingModeStatus } from '../hooks/use-signal-voting-mode';

const MEMBERSHIP_ERROR_PATTERN = /space member or delegate/i;

export { isArchivedSignalVoteError };

const EMPTY_SUMMARY: CoherenceUpvoteSummary = {
  totalVotingPower: '0',
  upvoteCount: 0,
  downvoteCount: 0,
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

export {
  SignalUpvoteCellChrome,
  SignalUpvoteTriangle,
} from './signal-upvote-cell';

type SignalUpvoteButtonProps = {
  slug?: string | null;
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
 * Up and down on one cell. The selected direction is filled; clicking it
 * again clears the vote, and clicking the other direction switches. The
 * figure is the net. The figure opens the voting-power slider in token spaces.
 */
export function SignalUpvoteButton({
  slug,
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
      try {
        await refresh?.();
      } catch {
        // Ranking refresh is best-effort; the local summary is already current.
      }
    },
    [refresh],
  );

  const run = React.useCallback(
    async (action: () => Promise<CoherenceUpvoteSummary | undefined>) => {
      if (!canVote || isMutating) return;
      setError(null);
      try {
        const next = await action();
        if (next) await applyResult(next);
      } catch (err) {
        console.warn('Could not update signal upvote:', err);
        if (
          err instanceof Error &&
          MEMBERSHIP_ERROR_PATTERN.test(err.message)
        ) {
          setRejectedAsNonMember(true);
          return;
        }
        if (isArchivedSignalVoteError(err)) {
          setError(t('upvoteArchived'));
          return;
        }
        setError(t('upvoteFailed'));
      }
    },
    [applyResult, canVote, isMutating, t],
  );

  const trimmedSlug = slug?.trim() ?? '';
  const handleDirection = (clicked: SignalVoteDirection) =>
    run(() => {
      const action = resolveSignalVoteAction(direction, clicked);
      if (action === 'remove') return removeUpvote({ slug: trimmedSlug });
      return upvote({
        slug: trimmedSlug,
        direction: action,
        ...(isOneMemberOneVote ? {} : { votingPowerPercent: percent }),
      });
    });
  const handleApplyPercent = () =>
    run(() =>
      upvote({
        slug: trimmedSlug,
        votingPowerPercent: percent,
        direction: direction ?? 'up',
      }),
    );
  const handleRemove = () => run(() => removeUpvote({ slug: trimmedSlug }));

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
  const cellLabel = t('net');
  const upLabel = direction === 'up' ? t('removeUpvote') : t('upvote');
  const downLabel = direction === 'down' ? t('removeDownvote') : t('downvote');

  return (
    <div
      className={cn('shrink-0', className)}
      onClick={stopPropagation}
      onKeyDown={stopPropagation}
    >
      <Popover
        open={open && canOpen}
        onOpenChange={(next) => {
          if (next && !canOpen) return;
          setOpen(next);
          if (next) {
            setPercent(myUpvotePercent(summary));
            setError(null);
          }
        }}
      >
        <PopoverAnchor asChild>
          <div>
            <SignalUpvoteCellChrome
              figure={figureLabel}
              exactLabel={exactLabel}
              label={cellLabel}
              pressed={hasVoted}
              direction={direction}
              upLabel={upLabel}
              downLabel={downLabel}
              voteDisabled={!canVote || isMutating}
              onVoteUp={() => handleDirection('up')}
              onVoteDown={() => handleDirection('down')}
              onFigureClick={() => {
                if (!canOpen) return;
                setOpen((current) => !current);
                setPercent(myUpvotePercent(summary));
                setError(null);
              }}
              aria-label={`${t('net')} · ${exactLabel}`}
              aria-busy={!canOpen}
              data-upvote-variant={variant}
              data-upvote-measure={cellMeasure.kind}
              className={cn(
                (isMutating || !canOpen) && 'opacity-65',
                !canOpen && 'cursor-progress',
              )}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="start"
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
              <div className="flex items-center justify-between gap-3">
                <span className="text-1 text-muted-foreground">
                  {isOneMemberOneVote ? t('totalUpvotes') : t('totalSupport')}
                </span>
                <span className="text-3 font-semibold tabular-nums text-foreground">
                  {totalLabel}
                </span>
              </div>

              {isOneMemberOneVote ? (
                <>
                  <span className="-mt-2 text-1 text-muted-foreground">
                    {t('oneMemberOneVote')}
                  </span>
                  {canVote ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant={direction === 'up' ? 'default' : 'outline'}
                        colorVariant="accent"
                        className="w-full gap-2"
                        disabled={isMutating}
                        aria-pressed={direction === 'up'}
                        onClick={() => handleDirection('up')}
                      >
                        <SignalUpvoteTriangle />
                        {direction === 'up' ? t('upvoted') : t('upvote')}
                      </Button>
                      <Button
                        type="button"
                        variant={direction === 'down' ? 'default' : 'outline'}
                        colorVariant="error"
                        className="w-full gap-2"
                        disabled={isMutating}
                        aria-pressed={direction === 'down'}
                        onClick={() => handleDirection('down')}
                      >
                        <SignalUpvoteTriangle className="rotate-180" />
                        {direction === 'down' ? t('downvoted') : t('downvote')}
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : canVote ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-1 text-foreground">
                      {direction === 'down'
                        ? t('downvoteWithVotingPower')
                        : t('upvoteWithVotingPower')}
                    </span>
                    <span className="text-1 font-semibold tabular-nums text-foreground">
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
                    aria-label={t('upvoteWithVotingPower')}
                  />
                  <Button
                    type="button"
                    colorVariant="accent"
                    className="w-full gap-2"
                    disabled={isMutating}
                    onClick={() => void handleApplyPercent()}
                  >
                    <SignalUpvoteTriangle />
                    {hasVoted ? t('updateUpvote') : t('upvote')}
                  </Button>
                  {hasVoted ? (
                    <Button
                      type="button"
                      variant="ghost"
                      colorVariant="neutral"
                      size="sm"
                      className="-mt-1 w-full text-muted-foreground hover:text-foreground"
                      disabled={isMutating}
                      onClick={() => void handleRemove()}
                    >
                      {t('removeUpvote')}
                    </Button>
                  ) : null}
                </>
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
              <span className="text-1 text-muted-foreground">
                {t('supportersCount', { count: summary.upvoteCount })}
              </span>
              {summary.voters.length > 0 ? (
                <ul className="-mt-1 flex max-h-48 flex-col gap-1.5 overflow-y-auto narrow-scrollbar">
                  {summary.voters.map((voter) => (
                    <li
                      key={voter.personId}
                      className="flex items-center justify-between gap-2 border border-border/70 px-2.5 py-2"
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
                      </span>
                      <span
                        className={cn(
                          'shrink-0 text-1 tabular-nums',
                          voter.direction === 'down'
                            ? 'text-error-11'
                            : 'text-muted-foreground',
                        )}
                      >
                        {voter.direction === 'down' ? '−' : ''}
                        {isOneMemberOneVote
                          ? t('votesCount', { count: 1 })
                          : formatVotingPowerCompact(
                              voter.votingPower,
                              summary.tokenDecimals,
                              locale,
                            )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
