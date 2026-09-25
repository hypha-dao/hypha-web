'use client';

import { ReactNode } from 'react';
import { cn } from '@hypha-platform/ui-utils';

type EcosystemNavigationShellProps = {
  className?: string;
  header?: ReactNode;
  children: ReactNode;
};

/**
 * Ecosystem column. Nested spaces is the only view — the stacked
 * Nested / Space-to-space / Values flows switcher is not part of this screen.
 */
export function EcosystemNavigationShell({
  className,
  header,
  children,
}: EcosystemNavigationShellProps) {
  return (
    <div className={cn('relative flex min-h-0 flex-col gap-4', className)}>
      {header ? <div className="w-full">{header}</div> : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
