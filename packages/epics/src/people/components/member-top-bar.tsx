'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { MessagesSquare, Moon, Sun, Wallet } from 'lucide-react';
import {
  getEnergyCommunityTokensForSpace,
  useSpaceBySlug,
} from '@hypha-platform/core/client';

import { APP_CHROME_ICON_TRIGGER } from '../../common/chrome-radius';
import { getDhoSpaceSlugFromPathname } from '../../common/get-dho-space-slug-from-pathname';
import {
  readRecentSpaceSlugs,
  subscribeRecentSpaceSlugs,
} from '../../common/recent-space-history';
import { useMemberNamedSpaces } from '../../network-exchange/use-member-named-spaces';
import { useUserAssets } from '../../treasury/hooks/use-user-assets';
import {
  memberMenuHref,
  memberSurfaceSpaceQuery,
  resolveMemberSpaceSlug,
} from './member-menu';
import { useMessagesScreenCount } from './my-connections';
import {
  formatMemberTokenAmount,
  selectMemberTokenPill,
  type MemberMintedToken,
} from './member-token-pill';

type MemberTopBarProps = {
  personSlug?: string;
  language?: ReactNode;
  resolvedTheme?: string;
  onToggleTheme?: () => void;
};

function useMemberBarSpaceSlug(): string | null {
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

  return useMemo(
    () =>
      resolveMemberSpaceSlug({
        pathSlug,
        querySlug: surfaceQuery,
        memberSlugs: named.map((space) => space.slug),
        recentSlugs: recent,
      }),
    [named, pathSlug, recent, surfaceQuery],
  );
}

export function MemberTopBar({
  personSlug,
  language,
  resolvedTheme,
  onToggleTheme,
}: MemberTopBarProps) {
  const tNav = useTranslations('Navigation');
  const tMember = useTranslations('MemberMenu');
  const tConnections = useTranslations('Connections');
  const params = useParams<{ lang?: string }>();
  const lang = typeof params.lang === 'string' ? params.lang : 'en';
  const slug = useMemberBarSpaceSlug();
  const { space, isLoading: spaceLoading } = useSpaceBySlug(slug ?? '');
  const spaceId = space?.id;
  const tokensEndpoint =
    spaceId != null ? `/api/v1/spaces/${spaceId}/tokens` : null;
  const { data: spaceTokens, error: tokensError } = useSWR(
    tokensEndpoint,
    async (url: string) => {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Failed to load space tokens: ${response.status}`);
      }
      return (await response.json()) as MemberMintedToken[];
    },
  );
  const { assets, isLoading: assetsLoading } = useUserAssets({
    personSlug,
    refreshInterval: 0,
  });
  const unread = useMessagesScreenCount();
  const dark = resolvedTheme === 'dark';

  const minted = useMemo(() => {
    const catalogue: MemberMintedToken[] = getEnergyCommunityTokensForSpace(
      slug,
    ).map((token) => ({
      address: token.address,
      symbol: token.symbol,
      type: token.type,
    }));
    const db = (Array.isArray(spaceTokens) ? spaceTokens : []).filter(
      (token) => spaceId != null && token.spaceId === spaceId,
    );
    const byAddress = new Map<string, MemberMintedToken>();
    for (const token of catalogue) {
      const key = token.address?.trim().toLowerCase();
      if (key) byAddress.set(key, token);
    }
    if (!tokensError) {
      for (const token of db) {
        const key = token.address?.trim().toLowerCase();
        if (key) byAddress.set(key, token);
      }
    }
    return [...byAddress.values()];
  }, [slug, spaceId, spaceTokens, tokensError]);

  const tokensReady =
    !slug ||
    (!spaceLoading &&
      (spaceId == null || spaceTokens !== undefined || Boolean(tokensError)));
  const pill =
    tokensReady && !assetsLoading
      ? selectMemberTokenPill({
          minted,
          holdings: assets.map((asset) => ({
            address: asset.address,
            value: asset.value,
          })),
        })
      : null;
  const amount = pill ? formatMemberTokenAmount(pill.amount, lang) : '';
  const messagesHref = memberMenuHref(lang, slug ?? '', 'messages');
  const walletHref = slug ? memberMenuHref(lang, slug, 'wallet') : '';
  const messageLabel =
    unread > 0
      ? `${tMember('messages')}, ${tConnections('unread', { count: unread })}`
      : tMember('messages');

  return (
    <div className="flex items-center gap-1.5 sm:gap-2" data-member-top-bar>
      {pill && amount && walletHref ? (
        <Link
          href={walletHref}
          data-member-token-pill
          className="inline-flex h-[36px] shrink-0 items-center gap-1.5 rounded-full border border-border/70 px-3 text-accent-11 transition-colors hover:bg-accent-2"
        >
          <Wallet
            className="size-3.5 shrink-0"
            strokeWidth={1.25}
            aria-hidden
          />
          <span className="text-[12px] font-medium tabular-nums leading-none">
            {amount} {pill.symbol}
          </span>
        </Link>
      ) : null}
      <span className="relative inline-flex">
        <Link
          href={messagesHref}
          className={APP_CHROME_ICON_TRIGGER}
          aria-label={messageLabel}
        >
          <MessagesSquare
            className="craft-icon"
            strokeWidth={1.25}
            aria-hidden
          />
        </Link>
        {unread > 0 ? (
          <span
            className="pointer-events-none absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center bg-accent-9 px-1 text-[10px] font-medium leading-none text-accent-contrast"
            aria-hidden
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </span>
      {language ? (
        <div className="[&_button[data-language-select-trigger]]:box-border [&_button[data-language-select-trigger]]:h-[36px] [&_button[data-language-select-trigger]]:w-[36px] [&_button[data-language-select-trigger]]:justify-center [&_button[data-language-select-trigger]]:gap-0 [&_button[data-language-select-trigger]]:border [&_button[data-language-select-trigger]]:border-border/70 [&_button[data-language-select-trigger]]:px-0 [&_button[data-language-select-trigger]>span[aria-hidden]]:hidden">
          {language}
        </div>
      ) : null}
      {onToggleTheme ? (
        <button
          type="button"
          className={APP_CHROME_ICON_TRIGGER}
          onClick={onToggleTheme}
          aria-label={
            dark ? tNav('switchToLightMode') : tNav('switchToDarkMode')
          }
        >
          {dark ? (
            <Sun className="craft-icon" strokeWidth={1.25} aria-hidden />
          ) : (
            <Moon className="craft-icon" strokeWidth={1.25} aria-hidden />
          )}
        </button>
      ) : null}
    </div>
  );
}
