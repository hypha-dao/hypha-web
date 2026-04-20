'use client';

import { cn } from '@hypha-platform/ui-utils';
import { type ReactNode } from 'react';

type SpaceHeaderActionsMeasureProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Join + actions row below the hero — in-flow only (no sticky / fixed mirror for now).
 */
export function SpaceHeaderActionsMeasure({
  children,
  className,
}: SpaceHeaderActionsMeasureProps) {
  return (
    <div
      data-space-header-actions
      className={cn('flex flex-wrap justify-end gap-2', className)}
    >
      {children}
    </div>
  );
}
