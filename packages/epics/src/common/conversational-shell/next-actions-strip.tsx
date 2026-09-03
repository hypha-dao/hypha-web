'use client';

import { cn } from '@hypha-platform/ui-utils';
import { Button } from '@hypha-platform/ui';

import type { NextAction } from './types';

export interface NextActionsStripProps {
  actions: NextAction[];
  /** Chip clicked — host injects `action.prompt` as the next turn or navigates. */
  onSelect: (action: NextAction) => void;
  className?: string;
}

/**
 * Presentational strip of suggested next steps (#2486 §4.2). `guidance` emphasis
 * = the D5 health-nudge chip. Renders nothing when there are no actions.
 */
export function NextActionsStrip({
  actions,
  onSelect,
  className,
}: NextActionsStripProps) {
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
