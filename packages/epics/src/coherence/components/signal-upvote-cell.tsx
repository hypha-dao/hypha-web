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
  // Keep the filled active state inset from the outer border (Button sm is min-h-8).
  'box-border h-6 max-h-6 min-h-6 w-6 max-w-6 min-w-6 shrink-0 self-center rounded-none border-0 p-0 normal-case tracking-normal shadow-none ring-0 hover:shadow-none focus-visible:ring-1 focus-visible:ring-offset-0';

type VoteArrowProps = {
  direction: 'up' | 'down';
  selected: 'up' | 'down' | null;
  label: string;
  disabled: boolean;
  allocates: boolean;
  expanded: boolean;
  onClick: () => void;
};

/**
 * Member stack arrows — one outlined cell, quiet ink.
 * Active state is colour only (no filled slab, no heavier stroke).
 */
const StackVoteArrow = React.forwardRef<HTMLButtonElement, VoteArrowProps>(
  function StackVoteArrow(
    { direction, selected, label, disabled, allocates, expanded, onClick },
    ref,
  ) {
    const active = selected === direction;
    const Icon = direction === 'up' ? ArrowUp : ArrowDown;
    return (
      <button
        ref={ref}
        type="button"
        data-testid={direction === 'up' ? 'signal-vote-up' : 'signal-vote-down'}
        aria-pressed={active}
        aria-label={label}
        aria-haspopup={allocates ? 'dialog' : undefined}
        aria-expanded={allocates ? expanded : undefined}
        disabled={disabled}
        className={cn(
          'grid h-[22px] w-full place-items-center rounded-none border-0 bg-transparent p-0 opacity-70 transition-opacity hover:opacity-100',
          active ? 'text-foreground opacity-100' : 'text-foreground',
          'disabled:opacity-40',
        )}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
      >
        <Icon className="size-4" strokeWidth={1.5} aria-hidden />
      </button>
    );
  },
);

/**
 * The allocation popover anchors to this button. The ref has to reach the
 * DOM node: Radix leaves an unanchored panel at `translate(0, -200%)`,
 * which is off-screen, so the click looks like it did nothing.
 */
const VoteArrow = React.forwardRef<HTMLButtonElement, VoteArrowProps>(
  function VoteArrow(
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
  },
);

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
  layout = 'row',
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
  /** Members stack the arrows. The shared row stays horizontal. */
  layout?: 'row' | 'stack';
}) {
  const selected = direction ?? (pressed ? 'up' : null);
  const allocates = allocationPanel != null;
  const Arrow = layout === 'stack' ? StackVoteArrow : VoteArrow;
  const up = (
    <Arrow
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
    <Arrow
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
        'rounded-none bg-transparent tabular-nums leading-none',
        layout === 'stack'
          ? 'grid h-[22px] w-full place-items-center px-1 text-center text-[13px] font-bold leading-none text-foreground'
          : 'min-w-4 px-1.5 text-1 font-medium',
        layout === 'stack'
          ? null
          : selected
          ? 'text-accent-11'
          : 'text-foreground',
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
      title={exactLabel.length > 18 ? figure : exactLabel}
      data-testid="signal-upvote-cell"
      data-vote-direction={selected ?? 'none'}
      {...groupProps}
      className={cn(
        'inline-flex rounded-none border border-border bg-transparent',
        layout === 'stack'
          ? // Energy-community signals stack: one outline, 56px column, no fill.
            'w-[56px] min-w-[56px] flex-col items-stretch overflow-hidden py-0.5'
          : // Row control: pad the shell so a filled arrow never kisses the border.
            'h-9 items-center gap-0.5 p-1',
        layout === 'stack' ? null : selected ? 'border-accent-8' : null,
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
