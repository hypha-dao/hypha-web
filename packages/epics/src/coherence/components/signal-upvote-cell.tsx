'use client';

import React from 'react';
import { ArrowDown, ArrowUp, Triangle } from 'lucide-react';
import { Button, Popover, PopoverAnchor } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

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

const arrowButtonClass =
  'h-6 min-h-0 w-6 rounded-full border-0 px-0 normal-case tracking-normal shadow-none ring-0 hover:shadow-none focus-visible:ring-1 focus-visible:ring-offset-0';

function VoteArrow({
  direction,
  selected,
  label,
  disabled,
  allocates,
  expanded,
  onClick,
}: {
  direction: 'up' | 'down';
  selected: 'up' | 'down' | null;
  label: string;
  disabled: boolean;
  allocates: boolean;
  expanded: boolean;
  onClick: () => void;
}) {
  const active = selected === direction;
  const Icon = direction === 'up' ? ArrowUp : ArrowDown;
  return (
    <Button
      type="button"
      variant="ghost"
      colorVariant="neutral"
      size="sm"
      data-testid={direction === 'up' ? 'signal-vote-up' : 'signal-vote-down'}
      aria-pressed={active}
      aria-label={label}
      aria-haspopup={allocates ? 'dialog' : undefined}
      aria-expanded={allocates ? expanded : undefined}
      disabled={disabled}
      className={cn(
        arrowButtonClass,
        active
          ? direction === 'up'
            ? 'bg-accent-9 text-accent-contrast hover:bg-accent-10 hover:text-accent-contrast'
            : 'bg-error-9 text-error-contrast hover:bg-error-10 hover:text-error-contrast'
          : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
      )}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <Icon className="size-3.5" strokeWidth={2} aria-hidden />
    </Button>
  );
}

/**
 * Shared face of the list and detail vote control. A horizontal outlined
 * pill: up arrow, net figure, down arrow. The figure keeps the full value
 * as its tooltip and accessible name.
 */
export function SignalUpvoteCellChrome({
  figure,
  exactLabel,
  pressed,
  direction,
  onVoteUp,
  onVoteDown,
  onFigureClick,
  voteDisabled = false,
  upLabel = 'Upvote',
  downLabel = 'Downvote',
  figureLabel,
  allocationDirection = null,
  onAllocationClose,
  allocationPanel,
  className,
  ...groupProps
}: React.HTMLAttributes<HTMLDivElement> & {
  figure: string;
  exactLabel: string;
  pressed: boolean;
  /** Set when this member has a vote. A pressed cell with no direction is an upvote. */
  direction?: 'up' | 'down' | null;
  onVoteUp?: () => void;
  onVoteDown?: () => void;
  onFigureClick?: () => void;
  voteDisabled?: boolean;
  upLabel?: string;
  downLabel?: string;
  figureLabel?: string;
  /** Which arrow's allocation panel is open. `null` keeps it closed. */
  allocationDirection?: 'up' | 'down' | null;
  onAllocationClose?: () => void;
  /** Token-voting panel. Present only when an arrow should allocate power. */
  allocationPanel?: React.ReactNode;
}) {
  const selected = direction ?? (pressed ? 'up' : null);
  const allocates = allocationPanel != null;
  const up = (
    <VoteArrow
      direction="up"
      selected={selected}
      label={upLabel}
      disabled={voteDisabled}
      allocates={allocates}
      expanded={allocationDirection === 'up'}
      onClick={() => onVoteUp?.()}
    />
  );
  const down = (
    <VoteArrow
      direction="down"
      selected={selected}
      label={downLabel}
      disabled={voteDisabled}
      allocates={allocates}
      expanded={allocationDirection === 'down'}
      onClick={() => onVoteDown?.()}
    />
  );
  const figureNode = onFigureClick ? (
    <button
      type="button"
      className={cn(
        'min-w-4 bg-transparent px-1.5 text-1 font-medium tabular-nums leading-none',
        selected === 'down'
          ? 'text-error-11'
          : selected === 'up'
          ? 'text-accent-11'
          : 'text-foreground',
      )}
      data-testid="signal-upvote-figure"
      aria-label={figureLabel ?? exactLabel}
      title={exactLabel}
      onClick={(event) => {
        event.stopPropagation();
        onFigureClick();
      }}
    >
      {figure}
    </button>
  ) : (
    <span
      className="min-w-4 px-1.5 text-1 font-medium tabular-nums leading-none text-foreground"
      data-testid="signal-upvote-figure"
      title={exactLabel}
    >
      {figure}
    </span>
  );

  const anchored = (node: React.ReactElement, side: 'up' | 'down') =>
    allocates && allocationDirection === side ? (
      <PopoverAnchor asChild>{node}</PopoverAnchor>
    ) : (
      node
    );

  const face = (
    <>
      {anchored(up, 'up')}
      {figureNode}
      {anchored(down, 'down')}
    </>
  );

  return (
    <div
      role="group"
      aria-pressed={pressed}
      title={exactLabel}
      data-testid="signal-upvote-cell"
      data-vote-direction={selected ?? 'none'}
      {...groupProps}
      className={cn(
        'inline-flex h-7 items-center rounded-full border bg-transparent px-0.5',
        selected === 'up'
          ? 'border-accent-8'
          : selected === 'down'
          ? 'border-error-8'
          : 'border-border',
        className,
      )}
    >
      {allocates ? (
        <Popover
          open={allocationDirection != null}
          onOpenChange={(open) => {
            if (!open) onAllocationClose?.();
          }}
        >
          {face}
          {allocationPanel}
        </Popover>
      ) : (
        face
      )}
    </div>
  );
}
