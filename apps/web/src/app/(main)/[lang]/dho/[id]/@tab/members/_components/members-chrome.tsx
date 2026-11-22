'use client';

import type { ReactNode } from 'react';

import { TabScreenTitle } from '../../_components/tab-screen-title';

/** Same page title as Treasury for every persona. */
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
    <div className="flex flex-col gap-4 py-4">
      <TabScreenTitle title={title} count={count} lang={lang} />
      {children}
    </div>
  );
}
