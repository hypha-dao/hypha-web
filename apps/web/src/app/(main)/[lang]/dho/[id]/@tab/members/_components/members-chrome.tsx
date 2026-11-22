'use client';

import type { ReactNode } from 'react';

import { MEMBER_SCREEN_STACK } from '../../../../_components/member-page-shell';
import { TabScreenTitle } from '../../_components/tab-screen-title';

/** Same page title chrome for every persona; members get the double title. */
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
  return (
    <div className={MEMBER_SCREEN_STACK}>
      <TabScreenTitle
        title={title}
        screen="members"
        count={count}
        lang={lang}
      />
      {children}
    </div>
  );
}
