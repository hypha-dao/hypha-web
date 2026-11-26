'use client';

import type { ReactNode } from 'react';
import {
  MemberSpacePageTitle,
  type MemberTitleScreen,
} from '@hypha-platform/epics';

type TabScreenTitleProps = {
  title: string;
  screen?: MemberTitleScreen;
  count?: number | null;
  lang?: string;
  /** Primary actions aligned with the page title (e.g. create). */
  actions?: ReactNode;
  filters?: ReactNode;
};

export function TabScreenTitle({
  title,
  screen,
  count,
  lang,
  actions,
  filters,
}: TabScreenTitleProps) {
  return (
    <MemberSpacePageTitle
      title={title}
      screen={screen}
      count={count}
      lang={lang}
      actions={actions}
      filters={filters}
    />
  );
}
