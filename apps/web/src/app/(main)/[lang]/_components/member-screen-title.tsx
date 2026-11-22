'use client';

import type { ReactNode } from 'react';
import {
  MemberSpacePageTitle,
  useMemberExperience,
} from '@hypha-platform/epics';

/**
 * Members see the Community / page-name double title used on space screens.
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

  return <MemberSpacePageTitle title={memberTitle} count={count} lang={lang} />;
}
