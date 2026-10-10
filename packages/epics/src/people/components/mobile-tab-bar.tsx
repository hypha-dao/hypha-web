'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import useSWR from 'swr';
import {
  Globe2,
  LayoutGrid,
  Plus,
  Settings,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  useJwt,
  useMe,
  type MemberIntelligence,
} from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import { cn } from '@hypha-platform/ui-utils';

import { MemberHomeQuickCreate } from './member-home-quick-create';

const SPACE_SLIDE_KEY = 'hypha:mobile-space-slide';

const iconClass = 'block size-5 shrink-0';

function segmentActive(pathname: string, segment: string) {
  return pathname.split('/').includes(segment);
}

export function MobileContentFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [slideIn, setSlideIn] = useState(false);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!window.matchMedia('(max-width: 767px)').matches) return;
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
    if (!window.matchMedia('(max-width: 767px)').matches) return;
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
        slideIn &&
          'max-md:animate-in max-md:slide-in-from-right max-md:duration-300 max-md:ease-out',
      )}
    >
      {children}
    </div>
  );
}

export function MobileTabBar() {
  const t = useTranslations('Navigation');
  const pathname = usePathname() ?? '';
  const params = useParams<{ lang?: string }>();
  const lang = (typeof params.lang === 'string' ? params.lang : 'en') as Locale;
  const router = useRouter();
  const { jwt } = useJwt();
  const { person } = useMe();
  const { isAuthenticated, logout } = useAuthentication();
  const { resolvedTheme, setTheme } = useTheme();
  const [spacesOpen, setSpacesOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const { data: home } = useSWR<MemberIntelligence | null>(
    jwt ? ['/api/v1/people/me/intelligence', jwt] : null,
    async ([url, token]) => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.status === 404) return null;
      if (!response.ok) return null;
      return (await response.json()) as MemberIntelligence;
    },
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setSpacesOpen(false);
    setCreateOpen(false);
  }, [pathname]);

  const dashboardHref = `/${lang}/my-dashboard`;
  const walletHref = `/${lang}/my-wallet`;
  const networkHref = `/${lang}/network`;
  const spacesHref = `/${lang}/my-spaces`;
  const profileHref = person?.slug
    ? `/${lang}/profile/${person.slug}`
    : `/${lang}/profile/signup`;

  const dashboardActive =
    !spacesOpen && !createOpen && segmentActive(pathname, 'my-dashboard');
  const spacesActive =
    spacesOpen ||
    segmentActive(pathname, 'my-spaces') ||
    segmentActive(pathname, 'dho');
  const walletActive =
    !spacesOpen && !createOpen && segmentActive(pathname, 'my-wallet');
  const networkActive =
    !spacesOpen && !createOpen && segmentActive(pathname, 'network');

  function openSpace(slug: string) {
    sessionStorage.setItem(SPACE_SLIDE_KEY, '1');
    setSpacesOpen(false);
    router.push(`/${lang}/dho/${slug}/overview`);
  }

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className={cn(
          'fixed inset-x-0 z-[35] flex flex-col border-l border-border bg-page-background transition-transform duration-300 ease-out md:hidden',
          !spacesOpen && 'pointer-events-none',
        )}
        style={{
          top: 70,
          bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))',
          transform: spacesOpen ? 'translateX(0)' : 'translateX(100%)',
        }}
        aria-hidden={!spacesOpen}
        inert={!spacesOpen}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p
            className="text-3 text-foreground"
            style={{ fontFamily: 'var(--font-family-heading)' }}
          >
            {t('mySpaces')}
          </p>
          <Link
            href={spacesHref}
            className="text-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => setSpacesOpen(false)}
          >
            {t('mobileSpacesAll')}
          </Link>
        </div>
        <div className="narrow-scrollbar min-h-0 flex-1 overflow-y-auto">
          {(home?.spaces ?? []).length === 0 ? (
            <p className="px-4 py-6 text-2 text-muted-foreground">
              {t('mobileSpacesEmpty')}
            </p>
          ) : (
            <ul>
              {(home?.spaces ?? []).map((space) => (
                <li key={space.id} className="border-b border-border">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent-2"
                    onClick={() => openSpace(space.slug)}
                  >
                    {space.logoUrl ? (
                      <img
                        src={space.logoUrl}
                        alt=""
                        className="size-9 object-cover"
                      />
                    ) : (
                      <span className="grid size-9 place-items-center border border-border text-1 text-muted-foreground">
                        {space.title.slice(0, 1)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-2 text-foreground">
                      {space.title}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div
        className={cn(
          'fixed inset-x-0 z-[35] flex flex-col border-t border-border bg-page-background transition-transform duration-300 ease-out md:hidden',
          !createOpen && 'pointer-events-none',
        )}
        style={{
          top: 70,
          bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))',
          transform: createOpen ? 'translateY(0)' : 'translateY(100%)',
        }}
        aria-hidden={!createOpen}
        inert={!createOpen}
      >
        <div className="narrow-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <MemberHomeQuickCreate lang={lang} spaces={home?.spaces ?? []} />
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
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-page-background md:hidden"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
        aria-label={t('openMenu')}
      >
        <div className="mx-auto grid h-14 max-w-lg grid-cols-5 items-end px-1">
          <TabLink
            href={dashboardHref}
            label={t('myDashboard')}
            active={dashboardActive}
            onClick={() => {
              setSpacesOpen(false);
              setCreateOpen(false);
            }}
            icon={<Sparkles className={iconClass} strokeWidth={1.25} />}
          />
          <TabButton
            label={t('mySpaces')}
            active={spacesActive}
            onClick={() => {
              setCreateOpen(false);
              setSpacesOpen((open) => !open);
            }}
            icon={<LayoutGrid className={iconClass} strokeWidth={1.25} />}
          />
          <TabLink
            href={walletHref}
            label={t('myWallet')}
            active={walletActive}
            center
            onClick={() => {
              setSpacesOpen(false);
              setCreateOpen(false);
            }}
            icon={
              <Wallet
                className="block size-[22px] shrink-0"
                strokeWidth={1.25}
              />
            }
          />
          <TabLink
            href={networkHref}
            label={t('network')}
            active={networkActive}
            onClick={() => {
              setSpacesOpen(false);
              setCreateOpen(false);
            }}
            icon={<Globe2 className={iconClass} strokeWidth={1.25} />}
          />
          <TabButton
            label={t('create')}
            active={createOpen}
            onClick={() => {
              setSpacesOpen(false);
              setCreateOpen((open) => !open);
            }}
            icon={<Plus className={iconClass} strokeWidth={1.25} />}
          />
        </div>
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
  onClick,
  icon,
}: {
  href: string;
  label: string;
  active: boolean;
  center?: boolean;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-end gap-1 pb-1.5 text-muted-foreground',
        active && 'text-foreground',
      )}
    >
      <TabGlyph active={active} center={center}>
        {icon}
      </TabGlyph>
      <span className="max-w-full truncate px-0.5 text-[10px] leading-none tracking-tight">
        {label}
      </span>
    </Link>
  );
}

function TabButton({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-end gap-1 pb-1.5 text-muted-foreground',
        active && 'text-foreground',
      )}
    >
      <TabGlyph active={active}>{icon}</TabGlyph>
      <span className="max-w-full truncate px-0.5 text-[10px] leading-none tracking-tight">
        {label}
      </span>
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
        'grid place-items-center',
        center
          ? cn(
              '-mt-3 size-11 border bg-page-background',
              active ? 'border-foreground' : 'border-border',
            )
          : 'size-8',
        active && !center && 'border-t border-foreground',
      )}
    >
      {children}
    </span>
  );
}
