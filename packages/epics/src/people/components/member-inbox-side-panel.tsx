'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { APP_CHROME_ICON_TRIGGER } from '../../common/chrome-radius';
import { getDhoSpaceSlugFromPathname } from '../../common/get-dho-space-slug-from-pathname';
import {
  readRecentSpaceSlugs,
  subscribeRecentSpaceSlugs,
} from '../../common/recent-space-history';
import { useMemberNamedSpaces } from '../../network-exchange/use-member-named-spaces';
import { memberSurfaceSpaceQuery, resolveMemberSpaceSlug } from './member-menu';
import { MyConnections } from './my-connections';

type MemberInboxSidePanelProps = {
  onClose: () => void;
};

/**
 * Right-panel conversations list for the member top-bar chat icon.
 * Mirrors energy-community MessagesDock: unified All list (no filter tabs),
 * search + scrollable rows for the active space when one is in context.
 */
export function MemberInboxSidePanel({ onClose }: MemberInboxSidePanelProps) {
  const t = useTranslations('MemberMenu');
  const tCommon = useTranslations('Common');
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const pathSlug = getDhoSpaceSlugFromPathname(pathname) ?? null;
  const surfaceQuery = memberSurfaceSpaceQuery(
    pathname,
    searchParams.get('space'),
  );
  const named = useMemberNamedSpaces();
  const [recent, setRecent] = useState<string[]>(() => readRecentSpaceSlugs());

  useEffect(() => subscribeRecentSpaceSlugs(setRecent), []);

  const spaceSlug = useMemo(
    () =>
      resolveMemberSpaceSlug({
        pathSlug,
        querySlug: surfaceQuery,
        memberSlugs: named.map((space) => space.slug),
        recentSlugs: recent,
      }) ?? undefined,
    [named, pathSlug, recent, surfaceQuery],
  );

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background"
      data-testid="member-inbox-side-panel"
    >
      <header className="flex h-[var(--menu-top-height,4.5rem)] shrink-0 items-center gap-2 border-b border-border px-3">
        <strong className="min-w-0 flex-1 truncate text-2 font-medium text-foreground">
          {t('messages')}
        </strong>
        <button
          type="button"
          className={APP_CHROME_ICON_TRIGGER}
          onClick={onClose}
          aria-label={tCommon('close')}
        >
          <X className="craft-icon" aria-hidden />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-3">
        <MyConnections
          section="messages"
          spaceSlug={spaceSlug}
          variant="panel"
        />
      </div>
    </div>
  );
}
