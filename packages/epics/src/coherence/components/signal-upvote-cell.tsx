'use client';

import React from 'react';
import { ArrowDown, ArrowUp, Triangle } from 'lucide-react';
import {
  Button,
  Popover,
  PopoverAnchor,
  PopoverTrigger,
} from '@hypha-platform/ui';
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
  'h-6 min-h-0 w-6 rounded-none border-0 px-0 normal-case tracking-normal shadow-none ring-0 hover:shadow-none focus-visible:ring-1 focus-visible:ring-offset-0';

/**
 * The allocation popover anchors to this button. The ref has to reach the
 * DOM node: Radix leaves an unanchored panel at `translate(0, -200%)`,
 * which is off-screen, so the click looks like it did nothing.
 */
const VoteArrow = React.forwardRef<
  HTMLButtonElement,
  {
    direction: 'up' | 'down';
    selected: 'up' | 'down' | null;
    label: string;
    disabled: boolean;
    allocates: boolean;
    expanded: boolean;
    onClick: () => void;
  }
>(function VoteArrow(
  { direction, selected, label, disabled, allocates, expanded, onClick },
  ref,
) {
  const active = selected === direction;
  const Icon = direction === 'up' ? ArrowUp : ArrowDown;
  return (
    <Button
      ref={ref}
      type="button"
      variant={active ? 'default' : 'ghost'}
      colorVariant={active ? 'accent' : 'neutral'}
      size="sm"
      data-testid={direction === 'up' ? 'signal-vote-up' : 'signal-vote-down'}
      aria-pressed={active}
      aria-label={label}
      aria-haspopup={allocates ? 'dialog' : undefined}
      aria-expanded={allocates ? expanded : undefined}
      disabled={disabled}
      className={cn(arrowButtonClass)}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <Icon className="size-3.5" strokeWidth={2} aria-hidden />
    </Button>
  );
});

/**
 * Shared face of the list and detail vote control. A square outlined row:
 * up arrow, net figure, down arrow. Each arrow keeps a stable popover
 * anchor so the allocation panel opens beside that arrow.
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
  detailsOpen = false,
  onDetailsOpenChange,
  detailsPanel,
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
  detailsOpen?: boolean;
  onDetailsOpenChange?: (open: boolean) => void;
  detailsPanel?: React.ReactNode;
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
  const figureNode = (
    <button
      type="button"
      className={cn(
        'min-w-4 rounded-none bg-transparent px-1.5 text-1 font-medium tabular-nums leading-none',
        selected ? 'text-accent-11' : 'text-foreground',
      )}
      data-testid="signal-upvote-figure"
      aria-label={figureLabel ?? exactLabel}
      aria-expanded={detailsPanel ? detailsOpen : undefined}
      aria-haspopup={detailsPanel ? 'dialog' : undefined}
      title={exactLabel}
      onClick={(event) => {
        event.stopPropagation();
        onFigureClick?.();
      }}
    >
      {figure}
    </button>
  );

  const arrow = (node: React.ReactElement, side: 'up' | 'down') =>
    allocates ? (
      <Popover
        open={allocationDirection === side}
        onOpenChange={(open) => {
          if (!open) onAllocationClose?.();
        }}
      >
        <PopoverAnchor asChild>{node}</PopoverAnchor>
        {allocationDirection === side ? allocationPanel : null}
      </Popover>
    ) : (
      node
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
        'inline-flex h-7 items-center rounded-none border bg-transparent px-0.5',
        selected ? 'border-accent-8' : 'border-border',
        className,
      )}
    >
      {arrow(up, 'up')}
      {detailsPanel ? (
        <Popover open={detailsOpen} onOpenChange={onDetailsOpenChange}>
          <PopoverTrigger asChild>{figureNode}</PopoverTrigger>
          {detailsPanel}
        </Popover>
      ) : (
        figureNode
      )}
      {arrow(down, 'down')}
    </div>
  );
}
