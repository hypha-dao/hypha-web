'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ArrowLeft, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { SidebarProvider } from '@hypha-platform/ui';

import { AiLeftPanel } from '../../common/ai-left-panel';
import { APP_CHROME_ICON_TRIGGER } from '../../common/chrome-radius';
import { getDhoSpaceSlugFromPathname } from '../../common/get-dho-space-slug-from-pathname';
import {
  readRecentSpaceSlugs,
  subscribeRecentSpaceSlugs,
} from '../../common/recent-space-history';
import { useHumanChatPanel } from '../../common/human-chat-panel-context';
import { useMemberNamedSpaces } from '../../network-exchange/use-member-named-spaces';
import { SpaceSwitcherMark } from '../../spaces/components/space-switcher-option';
import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';
import { memberSurfaceSpaceQuery, resolveMemberSpaceSlug } from './member-menu';

type MemberSpaceAiSidePanelProps = {
  onClose: () => void;
};

/**
 * Right-panel space AI conversation for members ("Ask this space").
 * Mirrors energy-community MessagesDock Vesta view: back to conversations,
 * space identity, close, and the space AI thread.
 */
export function MemberSpaceAiSidePanel({
  onClose,
}: MemberSpaceAiSidePanelProps) {
  const t = useTranslations('MemberMenu');
  const tCommon = useTranslations('Common');
  const { resolvedTheme } = useTheme();
  const { requestMemberInbox, dismissMemberSpaceAi } = useHumanChatPanel();
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
      }),
    [named, pathSlug, recent, surfaceQuery],
  );

  const namedMatch = named.find((space) => space.slug === spaceSlug) ?? null;
  const { space } = useSpaceBySlug(spaceSlug ?? '');
  const title =
    space?.title?.trim() || namedMatch?.title?.trim() || t('askGuide');
  const iconUrl = resolveSpaceDisplayLogoUrl(
    space ?? namedMatch,
    resolvedTheme === 'dark' ? 'dark' : 'light',
  );

  const backToInbox = () => {
    dismissMemberSpaceAi();
    requestMemberInbox();
  };

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background"
      data-testid="member-space-ai-side-panel"
    >
      <header className="flex h-[var(--menu-top-height,4.5rem)] shrink-0 items-center gap-2 border-b border-border px-3">
        <button
          type="button"
          className={APP_CHROME_ICON_TRIGGER}
          onClick={backToInbox}
          aria-label={t('messages')}
        >
          <ArrowLeft className="craft-icon" aria-hidden />
        </button>
        <SpaceSwitcherMark iconUrl={iconUrl} alt="" />
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-2 font-medium text-foreground">
            {title}
          </strong>
          <span className="block truncate text-1 text-muted-foreground">
            {t('askThisSpace')}
          </span>
        </div>
        <button
          type="button"
          className={APP_CHROME_ICON_TRIGGER}
          onClick={onClose}
          aria-label={tCommon('close')}
        >
          <X className="craft-icon" aria-hidden />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SidebarProvider open className="h-full min-h-0">
          <AiLeftPanel embed="panel" spaceSlugOverride={spaceSlug} />
        </SidebarProvider>
      </div>
    </div>
  );
}
