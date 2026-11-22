'use client';

import type { ReactNode } from 'react';
import { MemberSpacePageTitle } from '@hypha-platform/epics';

type TabScreenTitleProps = {
  title: string;
  count?: number | null;
  lang?: string;
  /** Primary actions aligned with the page title (e.g. create). */
  actions?: ReactNode;
  filters?: ReactNode;
};

export function TabScreenTitle({
  title,
  count,
  lang,
  actions,
  filters,
}: TabScreenTitleProps) {
  return (
    <MemberSpacePageTitle
      title={title}
      count={count}
      lang={lang}
      actions={actions}
      filters={filters}
    />
  );
}
