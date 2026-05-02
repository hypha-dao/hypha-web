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
  return (
    <div
      className={cn(
        'grid w-full grid-cols-1 gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center',
        className,
      )}
    >
      {left ? <div className="min-w-0">{left}</div> : <div />}
      {center ? <div className="min-w-0">{center}</div> : <div />}
      {right ? (
        <div className="justify-self-start lg:justify-self-end">{right}</div>
      ) : (
        <div />
      )}
    </div>
  );
}
