'use client';

import React from 'react';
import { Triangle } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';
import {
  SIGNAL_UPVOTE_CELL_CLASS,
  signalUpvoteFigureFontPx,
} from '../utils/signal-upvote-figure';

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

const directionButtonClass =
  'flex h-3 w-full shrink-0 items-center justify-center border-0 bg-transparent p-0 leading-none text-inherit disabled:cursor-not-allowed';

/**
 * Shared face of the list and detail vote control. Up and down sit around
 * the net figure. The caption stays the figure's next sibling so the layout
 * check can measure it. `exactLabel` is the full value (tooltip and name).
 */
export function SignalUpvoteCellChrome({
  figure,
  exactLabel,
  label,
  pressed,
  direction,
  onVoteUp,
  onVoteDown,
  onFigureClick,
  voteDisabled = false,
  upLabel = 'Upvote',
  downLabel = 'Downvote',
  className,
  ...groupProps
}: React.HTMLAttributes<HTMLDivElement> & {
  figure: string;
  exactLabel: string;
  label: string;
  pressed: boolean;
  /** Set when this member has a vote. A pressed cell with no direction is an upvote. */
  direction?: 'up' | 'down' | null;
  onVoteUp?: () => void;
  onVoteDown?: () => void;
  onFigureClick?: () => void;
  voteDisabled?: boolean;
  upLabel?: string;
  downLabel?: string;
}) {
  const selected = direction ?? (pressed ? 'up' : null);
  return (
    <div
      role="group"
      aria-pressed={pressed}
      title={exactLabel}
      data-testid="signal-upvote-cell"
      {...groupProps}
      className={cn(
        SIGNAL_UPVOTE_CELL_CLASS,
        'gap-0',
        selected === 'up'
          ? 'border-accent-9 bg-accent-3 text-foreground'
          : selected === 'down'
          ? 'border-error-9 bg-error-3 text-foreground'
          : 'border-border bg-background-2 text-foreground',
        className,
      )}
    >
      <button
        type="button"
        data-testid="signal-vote-up"
        aria-pressed={selected === 'up'}
        aria-label={upLabel}
        disabled={voteDisabled}
        className={cn(
          directionButtonClass,
          selected === 'up'
            ? 'bg-accent-9 text-accent-contrast'
            : 'text-muted-foreground hover:bg-accent-4 hover:text-foreground',
        )}
        onClick={(event) => {
          event.stopPropagation();
          onVoteUp?.();
        }}
      >
        <SignalUpvoteTriangle />
      </button>
      <span
        className="max-w-full whitespace-nowrap text-center font-semibold leading-none"
        style={{ fontSize: signalUpvoteFigureFontPx(figure) }}
        data-testid="signal-upvote-figure"
        role={onFigureClick ? 'button' : undefined}
        tabIndex={onFigureClick ? 0 : undefined}
        onClick={(event) => {
          event.stopPropagation();
          onFigureClick?.();
        }}
        onKeyDown={(event) => {
          if (!onFigureClick) return;
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          event.stopPropagation();
          onFigureClick();
        }}
      >
        {figure}
      </span>
      <span
        className={cn(
          'max-w-full whitespace-nowrap text-center text-[9px] leading-none',
          selected ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
      <button
        type="button"
        data-testid="signal-vote-down"
        aria-pressed={selected === 'down'}
        aria-label={downLabel}
        disabled={voteDisabled}
        className={cn(
          directionButtonClass,
          selected === 'down'
            ? 'bg-error-9 text-error-contrast'
            : 'text-muted-foreground hover:bg-error-4 hover:text-foreground',
        )}
        onClick={(event) => {
          event.stopPropagation();
          onVoteDown?.();
        }}
      >
        <SignalUpvoteTriangle className="rotate-180" />
      </button>
    </div>
  );
}
