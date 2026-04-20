'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { cn } from '@hypha-platform/ui-utils';

/**
 * DHO space routes use sticky chrome that meets MenuTop; skip root `pt-9` there
 * instead of negating margin per layout.
 */
function isDhoSpaceRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return /^\/[^/]+\/dho\/[^/]+/.test(pathname);
}

type AppContentPadProps = {
  children: ReactNode;
};

export function AppContentPad({ children }: AppContentPadProps) {
  const pathname = usePathname();
  const dho = isDhoSpaceRoute(pathname);

  return (
    <div className={cn('mb-auto pb-8', !dho && 'pt-9')}>
      <div className="flex h-full justify-normal">
        <div className="h-full w-full">{children}</div>
      </div>
    </div>
  );
}
