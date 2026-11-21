'use client';

import type { ReactNode } from 'react';
import { useMemberExperience } from '@hypha-platform/epics';

import { TabScreenTitle } from '../../_components/tab-screen-title';

/**
 * Members replace the page title with the directory header.
 * Builders and funders keep the space title, including while the profile loads.
 */
export function MembersChrome({
  title,
  count,
  lang,
  children,
}: {
  title: string;
  count?: number | null;
  lang?: string;
  children: ReactNode;
}) {
  const { isMember: memberDirectory } = useMemberExperience();

  return (
    <div className="flex flex-col gap-4 py-4">
      {memberDirectory ? null : (
        <TabScreenTitle title={title} count={count} lang={lang} />
      )}
      {children}
    </div>
  );
}
