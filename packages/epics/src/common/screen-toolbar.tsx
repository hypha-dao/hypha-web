'use client';

import type { ReactNode } from 'react';
import { cn } from '@hypha-platform/ui-utils';

type ScreenToolbarProps = {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  className?: string;
};

export function ScreenToolbar({
  left,
  center,
  right,
  className,
}: ScreenToolbarProps) {
  const hasLeft = Boolean(left);
  const hasCenter = Boolean(center);
  const hasRight = Boolean(right);
  const layoutClassName =
    hasLeft && hasCenter && hasRight
      ? 'grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center'
      : hasLeft && hasCenter
      ? 'grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center'
      : hasCenter && hasRight
      ? 'grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center'
      : hasLeft && hasRight
      ? 'grid-cols-1 lg:grid-cols-[auto_auto] lg:items-center'
      : 'grid-cols-1';

  return (
    <div className={cn('grid w-full gap-3', layoutClassName, className)}>
      {hasLeft ? <div className="min-w-0">{left}</div> : null}
      {hasCenter ? <div className="min-w-0">{center}</div> : null}
      {hasRight ? (
        <div className="justify-self-start lg:justify-self-end">{right}</div>
      ) : null}
    </div>
  );
}
