'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';

interface ProgressLineProps {
  label: string;
  /** Current score (e.g. participation or alignment %). */
  value: number;
  /** Track fill color for the current value bar. */
  indicatorColor?: string;
  /** Required threshold (space setting). Hidden when hideTargets is true. */
  target?: number;
  hideTargets?: boolean;
  /** When true, label the value as the user’s vote context instead of “Current”. */
  hasUserVoted?: boolean;
  /** Shorter labels and a thinner bar, for a card inside the chat. */
  dense?: boolean;
}

/** Threshold marker stays inside [4%, 96%] so labels don't clip at the rails. */
function clampThresholdMarker(target: number): number {
  return Math.min(96, Math.max(4, target));
}

export function ProgressLine({
  label,
  value,
  indicatorColor,
  target = 0,
  hideTargets,
  hasUserVoted = false,
  dense = false,
}: ProgressLineProps) {
  const tProposalDetails = useTranslations('ProposalDetails');
  const current = Math.min(100, Math.max(0, value));
  const markerLeft = clampThresholdMarker(target);

  return (
    <div className={cn('flex flex-col', dense ? 'gap-1' : 'gap-2.5')}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-1 font-medium text-foreground">{label}</span>
        <div
          className={cn(
            'flex flex-wrap items-baseline gap-x-4 tabular-nums',
            dense ? 'text-1' : 'text-sm',
          )}
        >
          <span className="text-muted-foreground">
            <span className="font-normal">
              {tProposalDetails(
                hasUserVoted ? 'voting.voteScore' : 'voting.currentScore',
              )}{' '}
              <span className="font-semibold text-foreground">
                {current.toFixed(2)}%
              </span>
            </span>
          </span>
          {!hideTargets ? (
            <span className="text-muted-foreground">
              <span className="font-normal">
                {tProposalDetails('voting.requiredScore', {
                  percent: target,
                })}
              </span>
            </span>
          ) : null}
        </div>
      </div>

      <div className={dense ? 'relative' : 'relative pt-1'}>
        {/* Track */}
        <div
          className={cn(
            'relative w-full overflow-hidden rounded-full',
            dense ? 'h-1.5' : 'h-3',
            'bg-muted/80 ring-1 ring-inset ring-border/60',
          )}
          aria-hidden
        >
          {/* Current progress */}
          <div
            className={cn(
              'absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ease-out',
              indicatorColor || 'bg-primary',
            )}
            style={{ width: `${current}%` }}
          />
          {/* Threshold marker */}
          {!hideTargets ? (
            <div
              className="pointer-events-none absolute inset-y-0 flex w-0 flex-col items-center"
              style={{ left: `${markerLeft}%`, transform: 'translateX(-50%)' }}
            >
              <div
                className="h-full w-0.5 rounded-full bg-warning-9 opacity-95 shadow-[0_0_0_1px_rgba(0,0,0,0.25)] dark:bg-warning-10"
                aria-hidden
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
