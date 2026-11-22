'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

import { useMemberExperience } from './member-experience';

type MemberSpacePageTitleProps = {
  title: string;
  count?: number | null;
  lang?: string;
  actions?: ReactNode;
  filters?: ReactNode;
};

function formatCount(count?: number | null, lang?: string): string | null {
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) {
    return null;
  }
  return Intl.NumberFormat(lang).format(count);
}

/**
 * Space-screen title for members: "Community" above the page name.
 * Builders and funders keep a single craft page title.
 */
export function MemberSpacePageTitle({
  title,
  count,
  lang,
  actions,
  filters,
}: MemberSpacePageTitleProps) {
  const t = useTranslations('MemberMenu');
  const { isMember } = useMemberExperience();
  const formattedCount = formatCount(count, lang);
  const heading = (
    <h1 className="craft-page-title m-0 text-6 font-medium">
      {title}
      {formattedCount ? (
        <span className="ml-2 text-4 font-normal text-muted-foreground">
          | {formattedCount}
        </span>
      ) : null}
    </h1>
  );

  return (
    <div className="flex flex-col gap-3">
      <header className="craft-page-header flex w-full flex-col items-start gap-1 text-left">
        {isMember ? (
          <p className="text-1 font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {t('community')}
          </p>
        ) : null}
        <div className="flex w-full items-start justify-between gap-3">
          {heading}
          {actions ? (
            <div className="flex shrink-0 items-center gap-2 pt-0.5">
              {actions}
            </div>
          ) : null}
        </div>
      </header>
      {filters ? <div>{filters}</div> : null}
    </div>
  );
}
