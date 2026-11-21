'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Coins,
  FileCheck2,
  Globe2,
  House,
  MessagesSquare,
  Radio,
  UsersRound,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useSpaceBySlug } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';

import { getDhoSpaceSlugFromPathname } from '../../common/get-dho-space-slug-from-pathname';
import {
  readRecentSpaceSlugs,
  subscribeRecentSpaceSlugs,
} from '../../common/recent-space-history';
import { useSpaceEnergy } from '../../treasury/hooks/use-space-energy';
import { useMemberNamedSpaces } from '../../network-exchange/use-member-named-spaces';
import { useMessagesScreenCount } from './my-connections';
import {
  buildMemberMenu,
  isCommunityMenuKey,
  memberMenuGroup,
  memberPersonalRedirect,
  resolveMemberSpaceSlug,
  type MemberMenuItem,
  type MemberMenuKey,
} from './member-menu';
import { useMemberExperience } from './member-experience';

const ICONS: Record<MemberMenuKey, LucideIcon> = {
  home: House,
  energy: Zap,
  wallet: Wallet,
  messages: MessagesSquare,
  signals: Radio,
  decisions: FileCheck2,
  treasury: Coins,
  members: UsersRound,
};

const TAB_BAR_PX = 68;
const SUB_NAV_PX = 52;

export function useMemberSpace() {
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const pathSlug = getDhoSpaceSlugFromPathname(pathname) ?? null;
  const onMessages = /^\/[^/]+\/(?:messages|connections)(?:\/|$)/.test(
    pathname,
  );
  const querySlug = onMessages ? searchParams.get('space') : null;
  const named = useMemberNamedSpaces();
  const [recent, setRecent] = useState<string[]>(() => readRecentSpaceSlugs());

  useEffect(() => subscribeRecentSpaceSlugs(setRecent), []);

  const slug = useMemo(
    () =>
      resolveMemberSpaceSlug({
        pathSlug,
        querySlug,
        memberSlugs: named.map((space) => space.slug),
        recentSlugs: recent,
      }),
    [named, pathSlug, querySlug, recent],
  );
  const namedSpace = named.find((space) => space.slug === slug) ?? null;
  const { space } = useSpaceBySlug(namedSpace || !slug ? '' : slug);
  const { data: energy } = useSpaceEnergy(slug ?? undefined);

  return {
    slug,
    title: namedSpace?.title ?? (space?.title?.trim() || null),
    energyEnabled: energy?.enabled === true,
  };
}

function useMemberMenuItems() {
  const pathname = usePathname() ?? '';
  const params = useParams<{ lang?: string }>();
  const lang = typeof params.lang === 'string' ? params.lang : 'en';
  const space = useMemberSpace();
  const items = useMemo(
    () =>
      buildMemberMenu({
        lang,
        spaceSlug: space.slug ?? '',
        pathname,
        energyEnabled: space.energyEnabled,
      }),
    [lang, pathname, space.energyEnabled, space.slug],
  );
  return { ...space, lang, pathname, items };
}

export function MemberSpaceFrame({ children }: { children: ReactNode }) {
  const { isMember: member } = useMemberExperience();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();
  const params = useParams<{ lang?: string }>();
  const lang = typeof params.lang === 'string' ? params.lang : 'en';
  const { slug } = useMemberSpace();
  const search = searchParams.toString() ? `?${searchParams.toString()}` : '';

  useEffect(() => {
    if (!member || !slug) return;
    const next = memberPersonalRedirect({
      pathname,
      search,
      lang,
      spaceSlug: slug,
    });
    if (!next || next === `${pathname}${search}`) return;
    router.replace(next);
  }, [lang, member, pathname, router, search, slug]);

  return children;
}

export function MemberMobileNav() {
  const t = useTranslations('MemberMenu');
  const unread = useMessagesScreenCount();
  const { items } = useMemberMenuItems();
  const [mounted, setMounted] = useState(false);
  const you = memberMenuGroup(items, 'you');
  const community = memberMenuGroup(items, 'community');
  const active = items.find((item) => item.active)?.key ?? null;
  const showCommunity = isCommunityMenuKey(active);
  const columns = you.length + 1;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const px = TAB_BAR_PX + (showCommunity ? SUB_NAV_PX : 0);
    document.documentElement.style.setProperty(
      '--mobile-tab-offset',
      `calc(${px}px + env(safe-area-inset-bottom, 0px))`,
    );
  }, [showCommunity]);

  if (!mounted) return null;

  return createPortal(
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-page-background xl:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label={t('menu')}
    >
      {showCommunity ? (
        <div
          className="flex justify-center gap-0.5 overflow-x-auto border-b border-border bg-background-2 px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ height: SUB_NAV_PX }}
          aria-label={t('community')}
        >
          {community.map((item) => (
            <MobileTab
              key={item.key}
              item={item}
              label={t(item.key)}
              unread={unread}
              compact
            />
          ))}
        </div>
      ) : null}
      <div
        className="mx-auto grid max-w-lg items-end px-1"
        style={{
          height: TAB_BAR_PX,
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        {you.map((item) => (
          <MobileTab
            key={item.key}
            item={item}
            label={t(item.key)}
            unread={unread}
          />
        ))}
        <MobileTab
          item={{
            key: 'signals',
            group: 'community',
            href: community[0]?.href ?? '',
            active: showCommunity,
          }}
          label={t('community')}
          unread={0}
          icon={Globe2}
        />
      </div>
    </nav>,
    document.body,
  );
}

function MobileTab({
  item,
  label,
  unread,
  compact = false,
  icon,
}: {
  item: MemberMenuItem;
  label: string;
  unread: number;
  compact?: boolean;
  icon?: LucideIcon;
}) {
  const Icon = icon ?? ICONS[item.key];
  const count = !icon && item.key === 'messages' ? unread : 0;
  const className = cn(
    'flex shrink-0 flex-col items-center justify-end gap-0.5 px-0.5 pb-1.5 text-muted-foreground',
    compact ? 'w-[4.25rem]' : 'pb-2',
    item.active && 'text-foreground',
    !item.href && 'pointer-events-none opacity-50',
  );
  const body = (
    <>
      <span
        className={cn(
          'relative grid shrink-0 place-items-center',
          item.active && 'border-t border-foreground',
        )}
        style={{ width: compact ? 22 : 28, height: compact ? 22 : 28 }}
      >
        <Icon
          className={compact ? 'h-4 w-4' : 'h-5 w-5'}
          strokeWidth={1.25}
          aria-hidden
        />
        {count > 0 ? (
          <span className="absolute -top-1 -right-1 inline-grid min-h-4 min-w-4 place-items-center bg-accent-9 px-1 text-[9px] font-medium leading-none text-accent-contrast">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </span>
      <span className="max-w-full truncate text-[10px] leading-tight tracking-tight">
        {label}
      </span>
    </>
  );
  if (!item.href) return <span className={className}>{body}</span>;
  return (
    <Link
      href={item.href}
      aria-current={item.active ? 'page' : undefined}
      className={className}
    >
      {body}
    </Link>
  );
}
