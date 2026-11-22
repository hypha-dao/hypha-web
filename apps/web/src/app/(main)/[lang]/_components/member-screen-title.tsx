'use client';

import type { ReactNode } from 'react';
import {
  MemberSpacePageTitle,
  type MemberTitleScreen,
  useMemberExperience,
} from '@hypha-platform/epics';

/**
 * Members get the small screen label + large title sentence.
 * Everyone else keeps the existing heading.
 */
export function MemberScreenTitle({
  screen,
  memberTitle,
  count,
  lang,
  children,
}: {
  screen: MemberTitleScreen;
  /** Unused for members when `screen` supplies copy; kept for clarity. */
  memberTitle?: string;
  count?: number | null;
  lang?: string;
  children: ReactNode;
}) {
  const { isMember } = useMemberExperience();
  if (!isMember) return children;

  return (
    <MemberSpacePageTitle
      title={memberTitle ?? screen}
      screen={screen}
      count={count}
      lang={lang}
    />
  );
}
