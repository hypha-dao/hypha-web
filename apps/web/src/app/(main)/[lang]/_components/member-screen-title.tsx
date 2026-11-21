'use client';

import type { ReactNode } from 'react';
import { useMe } from '@hypha-platform/core/client';
import { isMemberOrientation } from '@hypha-platform/epics';

/**
 * Members see the same page title as space screens such as Signals.
 * Everyone else keeps the existing heading.
 */
export function MemberScreenTitle({
  memberTitle,
  children,
}: {
  memberTitle: string;
  children: ReactNode;
}) {
  const { person, isLoading } = useMe();
  if (!isLoading && isMemberOrientation(person?.primaryOrientation)) {
    return (
      <header className="craft-page-header flex items-start justify-between gap-3">
        <h1 className="craft-page-title text-6 font-medium">{memberTitle}</h1>
      </header>
    );
  }
  return children;
}
