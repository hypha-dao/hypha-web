'use client';

import React from 'react';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { Triangle } from 'lucide-react';
import {
  useCoherenceUpvoteMutations,
  useJwt,
  type CoherenceUpvoteSummary,
  type SignalVotingMode,
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
import { PersonAvatar } from '../../people/components/person-avatar';
import { useSpaceAccentPortalStyles } from '../../spaces/components/space-accent-portal-context';
import { formatVotingPowerCompact } from '../utils/format-voting-power';
import type { SignalVotingModeStatus } from '../hooks/use-signal-voting-mode';

const MEMBERSHIP_ERROR_PATTERN = /space member or delegate/i;

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

export function SignalUpvoteTriangle({ className }: { className?: string }) {
  return (
    <Triangle
      className={cn('size-2.5 shrink-0', className)}
      fill="currentColor"
      strokeWidth={0}
      aria-hidden
    />
  );
}

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
  /** `feed` stacks the count over the label; `page` sits beside the title. */
  variant?: 'feed' | 'page';
  className?: string;
};

/**
 * The ▲ upvote cell. It opens the upvote panel directly: a voting power
 * slider in token spaces, a single toggle when each member has one vote.
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
  variant = 'feed',
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
  const hasVoted = summary.myUpvote != null;
  const isMutating = isUpvoting || isRemovingUpvote;
  const isVotingModeResolved = votingMode != null;
  const showVotingModeError =
    !isVotingModeResolved && votingModeStatus === 'error';
  const showVotingUnavailable =
    !isVotingModeResolved && votingModeStatus === 'unavailable';
  const canOpen =
    isVotingModeResolved || showVotingModeError || showVotingUnavailable;
  const isBlockedNonMember =
    Boolean(jwt) && (isNonMember || rejectedAsNonMember);
  const canVote =
    Boolean(slug?.trim()) &&
    Boolean(jwt) &&
    !disabled &&
    !isBlockedNonMember &&
    !isMembershipPending &&
    isVotingModeResolved;
  const isOneMemberOneVote = votingMode === 'one-member-one-vote';
  const [percent, setPercent] = React.useState(() => myUpvotePercent(summary));

  const totalLabel = isOneMemberOneVote
    ? format.number(summary.upvoteCount)
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
        setError(t('upvoteFailed'));
      }
    },
    [applyResult, canVote, isMutating, t],
  );

  const trimmedSlug = slug?.trim() ?? '';
  const handleToggle = () =>
    run(() =>
      hasVoted
        ? removeUpvote({ slug: trimmedSlug })
        : upvote({ slug: trimmedSlug }),
    );
  const handleApplyPercent = () =>
    run(() => upvote({ slug: trimmedSlug, votingPowerPercent: percent }));
  const handleRemove = () => run(() => removeUpvote({ slug: trimmedSlug }));

  const stopPropagation = React.useCallback(
    (event: React.SyntheticEvent) => event.stopPropagation(),
    [],
  );

  const cellLabel =
    variant === 'page'
      ? hasVoted
        ? t('upvoted')
        : t('upvote')
      : hasVoted
      ? t('voted')
      : t('upvote');

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
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-pressed={hasVoted}
            aria-label={`${t('upvote')} · ${summary.upvoteCount}`}
            aria-busy={!canOpen}
            disabled={!canOpen}
            data-testid="signal-upvote-cell"
            className={cn(
              'flex flex-col items-center justify-center border tabular-nums transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
              variant === 'feed' ? 'h-14 w-12 gap-0.5' : 'h-12 min-w-16 px-3',
              hasVoted
                ? 'border-accent-9 bg-accent-9 text-accent-contrast hover:bg-accent-10'
                : 'border-border bg-background-2 text-foreground hover:border-foreground/40',
              (isMutating || !canOpen) && 'opacity-65',
              !canOpen && 'cursor-progress',
            )}
          >
            {variant === 'feed' ? (
              <>
                <SignalUpvoteTriangle
                  className={hasVoted ? undefined : 'text-muted-foreground'}
                />
                <span className="text-base font-semibold leading-none">
                  {format.number(summary.upvoteCount)}
                </span>
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-base font-semibold leading-none">
                <SignalUpvoteTriangle
                  className={hasVoted ? undefined : 'text-muted-foreground'}
                />
                {format.number(summary.upvoteCount)}
              </span>
            )}
            <span
              className={cn(
                'text-[9px] leading-none',
                variant === 'page' && 'mt-1',
                hasVoted ? 'opacity-90' : 'text-muted-foreground',
              )}
            >
              {cellLabel}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-[min(18rem,calc(100vw-2rem))] rounded-none border border-border/80 bg-background-2 p-0 shadow-md"
          style={spaceAccentPortalStyle}
          data-space-accent-scope
          onClick={stopPropagation}
        >
          {showVotingModeError ? (
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
                    <Button
                      type="button"
                      variant={hasVoted ? 'default' : 'outline'}
                      colorVariant="accent"
                      className="w-full gap-2"
                      disabled={isMutating}
                      aria-pressed={hasVoted}
                      onClick={() => void handleToggle()}
                    >
                      <SignalUpvoteTriangle />
                      {hasVoted ? t('upvoted') : t('upvote')}
                    </Button>
                  ) : null}
                </>
              ) : canVote ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-1 text-foreground">
                      {t('upvoteWithVotingPower')}
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
                      <span className="shrink-0 text-1 tabular-nums text-muted-foreground">
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
