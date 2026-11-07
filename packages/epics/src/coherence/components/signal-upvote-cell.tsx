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

/**
 * Shared face of the list and detail upvote control. The figure string is
 * unchanged; only its size moves so a longer locale form stays inside the
 * square. `exactLabel` is the full value (tooltip and accessible name).
 */
export function SignalUpvoteCellChrome({
  figure,
  exactLabel,
  label,
  pressed,
  className,
  ...buttonProps
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  figure: string;
  exactLabel: string;
  label: string;
  pressed: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={exactLabel}
      data-testid="signal-upvote-cell"
      {...buttonProps}
      className={cn(
        SIGNAL_UPVOTE_CELL_CLASS,
        pressed
          ? 'border-accent-9 bg-accent-9 text-accent-contrast hover:bg-accent-10'
          : 'border-border bg-background-2 text-foreground hover:border-foreground/40',
        className,
      )}
    >
      <SignalUpvoteTriangle
        className={pressed ? undefined : 'text-muted-foreground'}
      />
      <span
        className="max-w-full whitespace-nowrap text-center font-semibold leading-none"
        style={{ fontSize: signalUpvoteFigureFontPx(figure) }}
        data-testid="signal-upvote-figure"
      >
        {figure}
      </span>
      <span
        className={cn(
          'max-w-full whitespace-nowrap text-center text-[9px] leading-none',
          pressed ? 'opacity-90' : 'text-muted-foreground',
        )}
      >
        {label}
      </span>
    </button>
  );
}
