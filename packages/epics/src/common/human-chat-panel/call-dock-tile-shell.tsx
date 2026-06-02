import type { ReactNode } from 'react';
import { cn } from '@hypha-platform/ui-utils';

export type CallDockAspectTileShellSizing = 'fit' | 'width';

/** Keeps 16:9 tiles fully visible inside dock panel cells (letterbox, never crop). */
export function CallDockAspectTileShell({
  children,
  className,
  sizing = 'fit',
}: {
  children: ReactNode;
  className?: string;
  /** `width` — intrinsic height from column width (scroll stacks). `fit` — letterbox inside cell. */
  sizing?: CallDockAspectTileShellSizing;
}) {
  if (sizing === 'width') {
    return (
      <div className={cn('w-full min-w-0 shrink-0', className)}>
        <div className="aspect-video w-full overflow-hidden [&>*]:h-full [&>*]:w-full">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex h-full min-h-0 w-full min-w-0 items-center justify-center overflow-hidden',
        className,
      )}
    >
      <div className="aspect-video max-h-full max-w-full overflow-hidden [&>*]:h-full [&>*]:w-full">
        {children}
      </div>
    </div>
  );
}
