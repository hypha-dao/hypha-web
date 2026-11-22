'use client';

import type { ReactNode } from 'react';
import { useMemberExperience } from '@hypha-platform/epics';

/**
 * Members see the same page title as Treasury / Signals.
 * Everyone else keeps the existing heading.
 */
export function MemberScreenTitle({
  memberTitle,
  count,
  lang,
  children,
}: {
  memberTitle: string;
  count?: number | null;
  lang?: string;
  children: ReactNode;
}) {
  const { isMember } = useMemberExperience();
  if (!isMember) return children;

  const formattedCount =
    typeof count === 'number' && Number.isFinite(count) && count >= 0
      ? Intl.NumberFormat(lang).format(count)
      : null;

  return (
    <header className="craft-page-header flex w-full items-start justify-between gap-3 text-left">
      <h1 className="craft-page-title m-0 text-6 font-medium">
        {memberTitle}
        {formattedCount ? (
          <span className="ml-2 text-4 font-normal text-muted-foreground">
            | {formattedCount}
          </span>
        ) : null}
      </h1>
    </header>
  );
}
