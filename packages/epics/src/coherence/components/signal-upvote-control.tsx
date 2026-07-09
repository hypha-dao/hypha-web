'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
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
  Separator,
  Slider,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { PersonAvatar } from '../../people/components/person-avatar';
import { useSpaceAccentPortalStyles } from '../../spaces/components/space-accent-portal-context';
import { formatVotingPowerCompact } from '../utils/format-voting-power';
import { SignalUpvoteIcon } from './signal-upvote-icon';

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

  // Drop the optimistic overlay whenever the parent delivers fresh upvote
  // data (refresh() or another member's vote), so the prop wins again.
  React.useEffect(() => {
    setLocalSummary(null);
  }, [upvotes]);

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
  const pillHeightClass = cn('min-h-0 py-0', compact ? 'h-5' : 'h-7');
  const iconSizeClass = compact ? 'h-3 w-3' : 'h-3.5 w-3.5';
  const hasAnyVotes = summary.upvoteCount > 0;

  return (
    <div
      className={cn('flex shrink-0 items-center', className)}
      onClick={stopPropagation}
      onKeyDown={stopPropagation}
    >
      <div
        className={cn(
          'group/upvote inline-flex items-stretch overflow-hidden rounded-full border shadow-sm backdrop-blur-[2px] transition-[border-color,box-shadow,background-color,opacity] duration-200 ease-out',
          pillHeightClass,
          hasVoted
            ? 'border-accent-8/70 bg-accent-3/45 shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent-8)_35%,transparent),0_4px_14px_-6px_color-mix(in_srgb,var(--accent-9)_55%,transparent)]'
            : 'border-border/75 bg-background/55 hover:border-border hover:bg-muted/25 hover:shadow-md',
          isMutating && 'pointer-events-none opacity-65',
          !canVote && 'opacity-55',
        )}
      >
        <Button
          type="button"
          variant="ghost"
          colorVariant={hasVoted ? 'accent' : 'neutral'}
          size="sm"
          className={cn(
            pillHeightClass,
            'gap-1 rounded-none border-0 px-0 tabular-nums shadow-none ring-0 hover:shadow-none focus-visible:ring-0 focus-visible:ring-offset-0',
            compact ? 'min-w-[2.75rem] px-2' : 'min-w-[3rem] px-2.5',
            hasVoted
              ? 'text-accent-11 hover:bg-accent-4/55 active:bg-accent-4/70'
              : 'text-muted-foreground hover:bg-muted/35 hover:text-foreground active:bg-muted/50',
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
          <SignalUpvoteIcon
            className={cn(
              iconSizeClass,
              'transition-transform duration-200 ease-out group-hover/upvote:scale-105',
              hasVoted && 'text-accent-11',
            )}
            active={hasVoted}
          />
          <span
            className={cn(
              compact ? 'text-[11px]' : 'text-1',
              hasVoted
                ? 'font-semibold text-accent-11'
                : hasAnyVotes
                ? 'font-medium text-foreground'
                : 'font-medium text-muted-foreground',
            )}
          >
            {totalLabel}
          </span>
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
                'w-7 rounded-none border-0 px-0 text-muted-foreground shadow-none ring-0 hover:bg-muted/35 hover:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=open]:bg-muted/45 data-[state=open]:text-foreground',
                hasVoted && 'text-accent-10 hover:text-accent-11',
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
            className="w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border/90 bg-background-2 p-0 shadow-xl ring-1 ring-white/5 dark:ring-white/10"
            style={spaceAccentPortalStyle}
            data-space-accent-scope
            onClick={stopPropagation}
          >
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-3 px-4 py-3.5">
                <span className="text-1 font-medium text-muted-foreground">
                  {t('totalSupport')}
                </span>
                <span className="text-3 font-semibold tabular-nums text-foreground">
                  {totalLabel}
                </span>
              </div>

              {canVote ? (
                <>
                  <Separator className="bg-border/70" />
                  <div className="flex flex-col gap-4 px-4 py-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-1 font-medium text-foreground">
                          {t('yourVotingPowerShare')}
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
                        <SignalUpvoteIcon className="h-4 w-4" active />
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
                <span className="text-1 font-medium text-muted-foreground">
                  {t('supportersCount', { count: summary.upvoteCount })}
                </span>
                {summary.voters.length > 0 ? (
                  <ul className="flex max-h-44 flex-col gap-1 overflow-y-auto rounded-xl border border-border/80 bg-muted/20 p-1.5 narrow-scrollbar">
                    {summary.voters.map((voter) => (
                      <li
                        key={voter.personId}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-background-3/70"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <PersonAvatar
                            size="sm"
                            shape="circle"
                            avatarSrc={voter.avatarUrl ?? ''}
                            userName={voter.name ?? undefined}
                          />
                          <span className="truncate text-1 font-medium text-foreground">
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
                ) : null}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
