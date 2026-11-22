'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import {
  Check,
  ChevronRight,
  ChevronsUpDown,
  MessagesSquare,
  Moon,
  Sun,
  Wallet,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@hypha-platform/ui';
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
import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';
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

function MemberCommunitySwitcher({
  lang,
  slug,
  resolvedTheme,
}: {
  lang: string;
  slug: string | null;
  resolvedTheme?: string;
}) {
  const tMember = useTranslations('MemberMenu');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const named = useMemberNamedSpaces();
  const [open, setOpen] = useState(false);
  const logoVariant = resolvedTheme === 'dark' ? 'dark' : 'light';
  const current = named.find((space) => space.slug === slug) ?? null;
  const title = current?.title?.trim() || slug || '';
  const location = current?.locationLabel?.trim() || '';
  const logo = resolveSpaceDisplayLogoUrl(current, logoVariant);

  if (!title) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        className="flex min-w-0 max-w-[11rem] items-center gap-2 xl:hidden"
        aria-label={tMember('yourCommunities')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent-3 text-[11px] font-medium text-foreground">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-full w-full object-cover" />
          ) : (
            title.charAt(0).toUpperCase()
          )}
        </span>
        <span className="min-w-0 text-left">
          <span className="block truncate text-2 font-medium leading-tight text-foreground">
            {title}
          </span>
          {location ? (
            <span className="block truncate text-1 leading-tight text-muted-foreground">
              {location}
            </span>
          ) : null}
        </span>
        <ChevronsUpDown
          className="h-4 w-4 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </button>
      <SheetContent
        side="bottom"
        closeLabel={tCommon('close')}
        className="max-h-[80vh] rounded-t-2xl px-4 pb-8 pt-3"
      >
        <SheetTitle className="pr-8 text-left text-5 font-medium">
          {tMember('yourCommunities')}
        </SheetTitle>
        <ul className="mt-4 divide-y divide-border">
          {named.map((space) => {
            const active = space.slug === slug;
            const mark = resolveSpaceDisplayLogoUrl(space, logoVariant);
            const place = space.locationLabel?.trim() || '';
            return (
              <li key={space.slug}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 py-3 text-left"
                  onClick={() => {
                    setOpen(false);
                    if (active) return;
                    router.push(`/${lang}/dho/${space.slug}/overview`);
                  }}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-accent-3 text-[11px] font-medium">
                    {mark ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={mark}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      space.title.charAt(0).toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-3 font-medium">
                    {space.title}
                    {place ? (
                      <span className="font-normal text-muted-foreground">
                        {' '}
                        · {place}
                      </span>
                    ) : null}
                  </span>
                  {active ? (
                    <Check className="h-4 w-4 shrink-0" aria-hidden />
                  ) : (
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
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
    spaceId != null ? `/api/v1/tokens?spaceId=${spaceId}` : null;
  const { data: spaceTokens, error: tokensError } = useSWR(
    tokensEndpoint,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`tokens ${response.status}`);
      }
      const payload = (await response.json()) as unknown;
      return Array.isArray(payload) ? (payload as MemberMintedToken[]) : [];
    },
  );
  const { assets, isLoading: assetsLoading } = useUserAssets({ personSlug });
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
      <MemberCommunitySwitcher
        lang={lang}
        slug={slug}
        resolvedTheme={resolvedTheme}
      />
      <div className="hidden items-center gap-1.5 sm:gap-2 xl:flex">
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
    </div>
  );
}
