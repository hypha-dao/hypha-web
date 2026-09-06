'use client';

import { cn } from '@hypha-platform/ui-utils';
import { Button } from '@hypha-platform/ui';

import type { NextAction } from './types';

export interface NextActionsStripProps {
  actions: NextAction[];
  /** Chip clicked — host injects `action.prompt` as the next turn or navigates. */
  onSelect: (action: NextAction) => void;
  /**
   * M8 — a voice turn is in flight: show skeleton chips instead of the stale set
   * until the reply settles (the host debounces the trailing edge).
   */
  loading?: boolean;
  className?: string;
}

const SKELETON_WIDTHS = ['5rem', '7rem', '6rem'];

/**
 * Presentational strip of suggested next steps (#2486 §4.2). `guidance` emphasis
 * = the D5 health-nudge chip. Renders nothing when there are no actions and it
 * is not loading.
 */
export function NextActionsStrip({
  actions,
  onSelect,
  loading = false,
  className,
}: NextActionsStripProps) {
  if (loading) {
    return (
      <div
        className={cn('flex flex-wrap items-center gap-2', className)}
        role="list"
        aria-label="Suggested next actions"
        aria-busy="true"
      >
        {SKELETON_WIDTHS.map((width) => (
          <span
            key={width}
            className="h-8 animate-pulse rounded-lg bg-muted/60"
            style={{ width }}
            aria-hidden
          />
        ))}
      </div>
    );
  }

  if (actions.length === 0) return null;

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      role="list"
      aria-label="Suggested next actions"
    >
      {actions.map((action) => (
        <Button
          key={action.id}
          type="button"
          role="listitem"
          size="sm"
          variant={action.emphasis === 'primary' ? 'default' : 'outline'}
          colorVariant={action.emphasis === 'guidance' ? 'accent' : 'neutral'}
          onClick={() => onSelect(action)}
          className={cn(
            action.emphasis === 'guidance' && 'border-dashed italic',
          )}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
