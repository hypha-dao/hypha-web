'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import {
  ArrowLeftRight,
  House,
  LayoutDashboard,
  LayoutGrid,
  Globe2,
  MessagesSquare,
  Plus,
  Rows3,
  Settings,
  Sparkles,
  Zap,
  Wallet,
} from 'lucide-react';
import { useAuthentication } from '@hypha-platform/authentication';
import { useMe, useSpaceBySlug } from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import { cn } from '@hypha-platform/ui-utils';

import { getDhoSpaceSlugFromPathname } from '../../common/get-dho-space-slug-from-pathname';
import { useAiPanel } from '../../common/human-chat-panel-context';
import { buildSpaceSectionNavItems } from '../../common/space-section-nav';
import type { SpaceSectionNavKey } from '../../common/space-section-nav';
import { SPACE_SECTION_NAV_ICONS } from '../../common/space-section-nav-icons';
import { isNetworkPath } from '../../common/use-is-space-context';
import { NetworkQuickCreate } from '../../network-exchange/network-quick-create';
import {
  buildWalletSectionNavItems,
  isWalletSectionNavActive,
} from '../../wallet/components/wallet-section-nav';
import {
  buildMessagesSectionNavItems,
  isMessagesSectionNavActive,
  isMessagesSectionPath,
} from './messages-section-nav';
import { useSpaceEnergy } from '../../treasury/hooks/use-space-energy';
import { useMemberEnergyCommunities } from './member-home-energy-panel';
import {
  HOME_VIEW_EVENT,
  readHomeView,
  writeHomeView,
  type HomeView,
} from './member-home-view';
import { useMessagesScreenCount } from './my-connections';
import {
  shouldShowMessagesNav,
  shouldShowSpacesScreen,
} from './app-nav-visibility';
import { MobileSpacesSubnav } from './mobile-spaces-subnav';

const OPEN_MOBILE_CREATE = 'hypha:open-mobile-create';

const SPACE_SLIDE_KEY = 'hypha:mobile-space-slide';

const iconClass = 'block h-5 w-5 shrink-0';
/** Secondary strip — a step quieter than primary tab icons. */
const subIconClass = 'block h-4 w-4 shrink-0';
/** Bar is fixed. Glyphs use px so the spacing scale cannot make them taller than the row. */
const TAB_BAR_PX = 68;
const SUB_NAV_PX = 52;
const TAB_GLYPH_PX = 28;
const SUB_GLYPH_PX = 22;
const TAB_CENTER_GLYPH_PX = 36;

function segmentActive(pathname: string, segment: string) {
  return pathname.split('/').includes(segment);
}

function shouldShowMobileSpacesRail(pathname: string) {
  return (
    segmentActive(pathname, 'connections') ||
    segmentActive(pathname, 'messages') ||
    segmentActive(pathname, 'my-wallet') ||
    segmentActive(pathname, 'my-dashboard') ||
    segmentActive(pathname, 'home') ||
    Boolean(getDhoSpaceSlugFromPathname(pathname)) ||
    isNetworkPath(pathname)
  );
}

export function MobileContentFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const params = useParams<{ lang?: string }>();
  const lang = (typeof params.lang === 'string' ? params.lang : 'en') as Locale;
  const { open: isAiOpen } = useAiPanel();
  const spaceSlug = getDhoSpaceSlugFromPathname(pathname);
  // While the AI panel is open the spaces list takes the left menu slot.
  const showSpacesRail = shouldShowMobileSpacesRail(pathname) && !isAiOpen;
  const [slideIn, setSlideIn] = useState(false);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!window.matchMedia('(max-width: 1279px)').matches) return;
      const anchor = (event.target as Element | null)?.closest?.('a');
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = anchor.getAttribute('href') ?? '';
      if (!href.includes('/dho/')) return;
      sessionStorage.setItem(SPACE_SLIDE_KEY, '1');
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    if (!window.matchMedia('(max-width: 1279px)').matches) return;
    if (!pathname.includes('/dho/')) return;
    if (sessionStorage.getItem(SPACE_SLIDE_KEY) !== '1') return;
    sessionStorage.removeItem(SPACE_SLIDE_KEY);
    setSlideIn(true);
    const timer = window.setTimeout(() => setSlideIn(false), 420);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return (
    <div
      className={cn(
        showSpacesRail &&
          'max-xl:flex max-xl:w-full max-xl:min-w-0 max-xl:flex-col',
        slideIn &&
          'max-md:animate-in max-md:slide-in-from-right max-md:duration-300 max-md:ease-out',
      )}
    >
      {showSpacesRail ? (
        // One row under the header circle — same chrome as the top toggle,
        // not a side column that floats next to the page.
        <div className="w-full shrink-0 xl:hidden">
          <MobileSpacesSubnav lang={lang} activeSlug={spaceSlug} layout="row" />
        </div>
      ) : null}
      <div className={cn(showSpacesRail && 'min-w-0 flex-1')}>{children}</div>
    </div>
  );
}

export function MobileTabBar({
  spaceMemoryEnabled = false,
}: {
  spaceMemoryEnabled?: boolean;
}) {
  const t = useTranslations('Navigation');
  const tCommon = useTranslations('Common');
  const tCoherence = useTranslations('CoherenceTab');
  const tNetwork = useTranslations('NetworkExchange');
  const tMyWallet = useTranslations('MyWallet');
  const tConnections = useTranslations('Connections');
  const tHome = useTranslations('MemberHome');
  const tEnergy = useTranslations('MemberHome.energy');
  const tTreasury = useTranslations('TreasuryTab');
  const pathname = usePathname() ?? '';
  const params = useParams<{ lang?: string }>();
  const lang = (typeof params.lang === 'string' ? params.lang : 'en') as Locale;
  const { person } = useMe();
  const showMessages = shouldShowMessagesNav(person?.primaryOrientation);
  const showSpaces = shouldShowSpacesScreen(person?.primaryOrientation);
  const appTabCount = 3 + Number(showMessages) + Number(showSpaces);
  const onHome =
    pathname === `/${lang}/my-dashboard` ||
    pathname === `/${lang}/my-dashboard/` ||
    pathname === `/${lang}/home` ||
    pathname === `/${lang}/home/`;
  const { communities: energyCommunities } = useMemberEnergyCommunities(
    onHome ? person?.slug : null,
  );
  const { isAuthenticated, logout } = useAuthentication();
  const { resolvedTheme, setTheme } = useTheme();
  const [createOpen, setCreateOpen] = useState(false);
  const [homeView, setHomeView] = useState<HomeView>('ai');
  const [mounted, setMounted] = useState(false);
  const unreadCount = useMessagesScreenCount();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const sync = () => setHomeView(readHomeView());
    sync();
    window.addEventListener(HOME_VIEW_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(HOME_VIEW_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    const openCreate = () => {
      setCreateOpen(true);
    };
    window.addEventListener(OPEN_MOBILE_CREATE, openCreate);
    return () => window.removeEventListener(OPEN_MOBILE_CREATE, openCreate);
  }, []);

  useEffect(() => {
    setCreateOpen(false);
  }, [pathname]);

  const spaceSlug = getDhoSpaceSlugFromPathname(pathname);
  const { space } = useSpaceBySlug(spaceSlug ?? '');
  const { data: spaceEnergy } = useSpaceEnergy();
  const networkRoute = isNetworkPath(pathname);
  const secondLevel = useMemo((): Array<{
    key: string;
    href: string;
    label: string;
    active: boolean;
    icon: ReactNode;
    onClick?: () => void;
    external?: boolean;
    disabled?: boolean;
  }> => {
    const homeRoute =
      pathname === `/${lang}/my-dashboard` ||
      pathname === `/${lang}/my-dashboard/` ||
      pathname === `/${lang}/home` ||
      pathname === `/${lang}/home/`;
    if (homeRoute) {
      const views: Array<{
        key: HomeView;
        label: string;
        icon: typeof Sparkles;
      }> = [
        { key: 'ai', label: tHome('viewAi'), icon: Sparkles },
        {
          key: 'classic' as const,
          label: tHome('viewClassic'),
          icon: Rows3,
        },
        {
          key: 'field' as const,
          label: tHome('viewField'),
          icon: LayoutDashboard,
        },
      ];
      if (energyCommunities.length > 0) {
        views.push({
          key: 'energy',
          label: tEnergy('title'),
          icon: Zap,
        });
      }
      return views.map((view) => ({
        key: view.key,
        href: '',
        label: view.label,
        active: homeView === view.key,
        onClick: () => writeHomeView(view.key),
        icon: <view.icon className={subIconClass} strokeWidth={1.5} />,
      }));
    }
    if (spaceSlug) {
      const labelFor = (key: SpaceSectionNavKey): string => {
        switch (key) {
          case 'overview':
            return tCommon('overview');
          case 'agreements':
            return tCommon('Agreements');
          case 'members':
            return tCommon('Members');
          case 'treasury':
            return tCommon('Treasury');
          case 'calendar':
            return tCommon('Calendar');
          case 'coherence':
            return tCommon('Signals');
          case 'pipeline':
            return tCommon('Pipeline');
          case 'energy':
            return tCommon('Energy');
          case 'rewards':
            return tTreasury('rewardsSection.title');
          case 'memory':
            return tCoherence('spaceMemory');
          default:
            return key;
        }
      };
      return buildSpaceSectionNavItems({
        lang,
        spaceSlug,
        pathname,
        pipelineEnabled: Boolean(space?.pipelineEnabled),
        energyEnabled: Boolean(spaceEnergy?.enabled),
        coherenceEnabled: true,
        memoryEnabled: spaceMemoryEnabled,
      }).map((item) => {
        const Icon = SPACE_SECTION_NAV_ICONS[item.key];
        return {
          key: item.key,
          href: item.href,
          label: labelFor(item.key),
          active: item.active,
          icon: <Icon className={subIconClass} strokeWidth={1.5} />,
        };
      });
    }
    if (segmentActive(pathname, 'my-wallet')) {
      const base = `/${lang}/my-wallet`;
      return buildWalletSectionNavItems(base).map((item) => {
        const Icon = item.icon;
        return {
          key: item.key,
          href: item.href,
          label: tMyWallet(item.labelKey),
          active: isWalletSectionNavActive(item, pathname),
          icon: <Icon className={subIconClass} strokeWidth={1.5} />,
        };
      });
    }
    if (isMessagesSectionPath(pathname)) {
      const base = `/${lang}/messages`;
      return buildMessagesSectionNavItems(base).map((item) => {
        const Icon = item.icon;
        return {
          key: item.key,
          href: item.href,
          label: tConnections(item.labelKey),
          active: isMessagesSectionNavActive(item, pathname),
          icon: <Icon className={subIconClass} strokeWidth={1.5} />,
        };
      });
    }
    if (!networkRoute) return [];
    const base = `/${lang}/network`;
    const links = [
      {
        key: 'network',
        label: tNetwork('navNetwork'),
        href: base,
        icon: Globe2,
        exact: true,
      },
      {
        key: 'exchange',
        label: tNetwork('navExchange'),
        href: `${base}/exchange`,
        icon: ArrowLeftRight,
      },
    ] as const;
    return links.map((link) => ({
      key: link.key,
      href: link.href,
      label: link.label,
      active:
        'exact' in link && link.exact
          ? pathname === base || pathname === `${base}/`
          : pathname === link.href || pathname.startsWith(`${link.href}/`),
      icon: <link.icon className={subIconClass} strokeWidth={1.5} />,
    }));
  }, [
    energyCommunities.length,
    homeView,
    lang,
    networkRoute,
    pathname,
    space?.pipelineEnabled,
    spaceEnergy?.enabled,
    spaceMemoryEnabled,
    spaceSlug,
    tMyWallet,
    tConnections,
    tCoherence,
    tEnergy,
    tHome,
    tCommon,
    tNetwork,
    tTreasury,
  ]);

  const showSectionStrip = secondLevel.length > 0;
  const showAppMenu = true;

  useEffect(() => {
    const px =
      (showAppMenu ? TAB_BAR_PX : 0) + (showSectionStrip ? SUB_NAV_PX : 0);
    document.documentElement.style.setProperty(
      '--mobile-tab-offset',
      `calc(${px}px + env(safe-area-inset-bottom, 0px))`,
    );
    return () => {
      document.documentElement.style.removeProperty('--mobile-tab-offset');
    };
  }, [showAppMenu, showSectionStrip]);

  const dashboardHref = `/${lang}/home`;
  const connectionsHref = `/${lang}/messages`;
  const spacesHref = `/${lang}/my-spaces`;
  const walletHref = `/${lang}/my-wallet`;
  const networkHref = `/${lang}/network`;
  const profileHref = person?.slug
    ? `/${lang}/profile/${person.slug}`
    : `/${lang}/profile/signup`;

  const dashboardActive =
    !createOpen &&
    (segmentActive(pathname, 'my-dashboard') ||
      segmentActive(pathname, 'home'));
  const connectionsActive =
    !createOpen &&
    (segmentActive(pathname, 'messages') ||
      segmentActive(pathname, 'connections'));
  const spacesActive =
    !createOpen &&
    (segmentActive(pathname, 'my-spaces') || segmentActive(pathname, 'dho'));
  const walletActive = !createOpen && segmentActive(pathname, 'my-wallet');
  const networkActive = !createOpen && segmentActive(pathname, 'network');

  if (!mounted) return null;
  if (!showSectionStrip && !showAppMenu) return null;

  return createPortal(
    <>
      <div
        className={cn(
          'fixed inset-x-0 z-[35] flex flex-col border-t border-border bg-page-background transition-transform duration-300 ease-out xl:hidden',
          !createOpen && 'pointer-events-none',
        )}
        style={{
          top: 70,
          bottom:
            'var(--mobile-tab-offset, calc(64px + env(safe-area-inset-bottom, 0px)))',
          transform: createOpen ? 'translateY(0)' : 'translateY(100%)',
        }}
        aria-hidden={!createOpen}
        inert={!createOpen}
      >
        <div className="narrow-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <NetworkQuickCreate lang={lang} />
          <div className="mt-6 border border-border">
            <p className="border-b border-border px-3 py-2 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
              {t('settings')}
            </p>
            <Link
              href={profileHref}
              className="flex items-center gap-3 border-b border-border px-3 py-3 text-2 text-foreground hover:bg-accent-2"
              onClick={() => setCreateOpen(false)}
            >
              <Settings className={iconClass} strokeWidth={1.25} aria-hidden />
              {t('myProfile')}
            </Link>
            <button
              type="button"
              className="flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left text-2 text-foreground hover:bg-accent-2"
              onClick={() =>
                setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
              }
            >
              <span className="flex-1">
                {resolvedTheme === 'dark'
                  ? t('switchToLightMode')
                  : t('switchToDarkMode')}
              </span>
            </button>
            {isAuthenticated ? (
              <button
                type="button"
                className="flex w-full items-center px-3 py-3 text-left text-2 text-error-11 hover:bg-accent-2"
                onClick={() => logout()}
              >
                {t('logout')}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-page-background xl:hidden"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        aria-label={t('openMenu')}
      >
        {showSectionStrip ? (
          <div
            className="flex justify-center gap-0.5 overflow-x-auto border-b border-border bg-background-2 px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ height: SUB_NAV_PX }}
            aria-label={
              spaceSlug
                ? t('mySpaces')
                : isMessagesSectionPath(pathname)
                ? tConnections('tabs.messages')
                : t('network')
            }
          >
            {secondLevel.map((item) => {
              const className = cn(
                'flex w-[4.25rem] shrink-0 flex-col items-center justify-end gap-0.5 border-0 bg-transparent px-0.5 pb-1.5 text-muted-foreground',
                item.active && 'text-foreground',
                item.disabled && 'opacity-50',
              );
              const body = (
                <>
                  <span
                    className={cn(
                      'grid shrink-0 place-items-center',
                      item.active && 'border-t border-foreground',
                    )}
                    style={{ width: SUB_GLYPH_PX, height: SUB_GLYPH_PX }}
                  >
                    {item.icon}
                  </span>
                  <span className="max-w-full truncate text-[9px] leading-tight tracking-tight">
                    {item.label}
                  </span>
                </>
              );
              if (item.onClick || item.disabled) {
                return (
                  <button
                    key={item.key}
                    type="button"
                    disabled={item.disabled}
                    onClick={item.onClick}
                    className={className}
                  >
                    {body}
                  </button>
                );
              }
              if (item.external) {
                return (
                  <a
                    key={item.key}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={className}
                  >
                    {body}
                  </a>
                );
              }
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={item.active ? 'page' : undefined}
                  className={className}
                >
                  {body}
                </Link>
              );
            })}
          </div>
        ) : null}
        {showAppMenu ? (
          <div
            className="mx-auto grid max-w-lg items-end px-1"
            style={{
              height: TAB_BAR_PX,
              gridTemplateColumns: `repeat(${appTabCount}, minmax(0, 1fr))`,
            }}
          >
            <TabLink
              href={dashboardHref}
              label={t('myDashboard')}
              active={dashboardActive}
              onClick={() => setCreateOpen(false)}
              icon={<House className={iconClass} strokeWidth={1.25} />}
            />
            {showMessages ? (
              <TabLink
                href={connectionsHref}
                label={t('chat')}
                active={connectionsActive}
                badge={unreadCount}
                onClick={() => setCreateOpen(false)}
                icon={
                  <MessagesSquare className={iconClass} strokeWidth={1.25} />
                }
              />
            ) : null}
            <TabLink
              href={walletHref}
              label={t('myWallet')}
              active={walletActive}
              center
              onClick={() => setCreateOpen(false)}
              icon={
                <Wallet className="block h-5 w-5 shrink-0" strokeWidth={1.25} />
              }
            />
            {showSpaces ? (
              <TabLink
                href={spacesHref}
                label={t('mySpaces')}
                active={spacesActive}
                onClick={() => setCreateOpen(false)}
                icon={<LayoutGrid className={iconClass} strokeWidth={1.25} />}
              />
            ) : null}
            <TabLink
              href={networkHref}
              label={t('network')}
              active={networkActive}
              onClick={() => setCreateOpen(false)}
              icon={<Globe2 className={iconClass} strokeWidth={1.25} />}
            />
          </div>
        ) : null}
      </nav>
    </>,
    document.body,
  );
}

function TabLink({
  href,
  label,
  active,
  center,
  badge = 0,
  onClick,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  center?: boolean;
  badge?: number;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-end gap-0.5 overflow-visible pb-2 text-muted-foreground',
        active && 'text-foreground',
      )}
    >
      <span className="relative">
        <TabGlyph active={active} center={center}>
          {icon}
        </TabGlyph>
        {badge > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center bg-foreground px-0.5 text-[9px] font-medium leading-none text-background">
            <span className="translate-y-px">{badge > 99 ? '99+' : badge}</span>
          </span>
        ) : null}
      </span>
      <span className="max-w-full truncate px-0.5 text-[10px] leading-tight tracking-tight">
        {label}
      </span>
    </Link>
  );
}

export function MobileCreateButton() {
  const t = useTranslations('Navigation');
  return (
    <button
      type="button"
      className="grid h-[36px] w-[36px] place-items-center text-foreground xl:hidden"
      aria-label={t('create')}
      onClick={() => window.dispatchEvent(new Event(OPEN_MOBILE_CREATE))}
    >
      <Plus className="h-5 w-5" strokeWidth={1.25} aria-hidden />
    </button>
  );
}

function TabGlyph({
  active,
  center,
  children,
}: {
  active: boolean;
  center?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center',
        center &&
          cn(
            'border bg-page-background',
            active ? 'border-foreground' : 'border-border',
          ),
        active && !center && 'border-t border-foreground',
      )}
      style={{
        width: center ? TAB_CENTER_GLYPH_PX : TAB_GLYPH_PX,
        height: center ? TAB_CENTER_GLYPH_PX : TAB_GLYPH_PX,
        marginTop: center ? -10 : undefined,
      }}
    >
      {children}
    </span>
  );
}
