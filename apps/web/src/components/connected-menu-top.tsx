'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MenuTop } from '@hypha-platform/ui';
import {
  getDhoSpaceSlugFromPathname,
  getRootSpace,
  isSafeImageUrl,
} from '@hypha-platform/epics';
import useSWR from 'swr';
import { Space } from '@hypha-platform/core/client';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Pencil } from 'lucide-react';

type ConnectedMenuTopProps = {
  children?: ReactNode;
  leadingAction?: ReactNode;
  trailingAction?: ReactNode;
  logoHref?: string;
  hrefTarget?: string;
  openMenuLabel?: string;
  closeMenuLabel?: string;
  aiChatEnabled: boolean;
};

function hasCustomRootLogo(logoUrl: string): boolean {
  return logoUrl.trim().length > 0;
}

export function ConnectedMenuTop({
  children,
  leadingAction,
  trailingAction,
  logoHref,
  hrefTarget,
  openMenuLabel,
  closeMenuLabel,
  aiChatEnabled,
}: ConnectedMenuTopProps) {
  const pathname = usePathname();
  const router = useRouter();
  const tNavigation = useTranslations('Navigation');
  const { resolvedTheme } = useTheme();
  const lang = useMemo(() => {
    const match = pathname.match(/^\/([^/]+)\//);
    return match?.[1] ?? 'en';
  }, [pathname]);
  const activeSpaceSlug = useMemo(
    () => getDhoSpaceSlugFromPathname(pathname),
    [pathname],
  );
  const isSpaceRoute = Boolean(activeSpaceSlug);
  const { data: allSpaces = [], isLoading: isLoadingSpaces } = useSWR<Space[]>(
    isSpaceRoute ? '/api/v1/spaces?parentOnly=false' : null,
    async (url: string) => {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) {
        console.warn('[ConnectedMenuTop] spaces fetch failed', {
          status: response.status,
          url,
        });
        return [];
      }
      return (await response.json()) as Space[];
    },
  );
  const rootSpace = useMemo(() => {
    if (!activeSpaceSlug) return null;
    const activeSpace = allSpaces.find(
      (space) => space.slug === activeSpaceSlug,
    );
    return getRootSpace(activeSpace, allSpaces);
  }, [activeSpaceSlug, allSpaces]);
  const rootConfigHref =
    rootSpace?.slug != null
      ? `/${lang}/dho/${rootSpace.slug}/agreements/space-configuration`
      : logoHref;
  useEffect(() => {
    if (!rootConfigHref || rootConfigHref === '#') return;
    if (pathname.endsWith('/space-configuration')) return;
    router.prefetch(rootConfigHref);
  }, [pathname, rootConfigHref, router]);
  const rootLogoLight = rootSpace?.ecosystemLogoUrlLight?.trim() || '';
  const rootLogoDark = rootSpace?.ecosystemLogoUrlDark?.trim() || '';
  const rootLogoLegacy = rootSpace?.ecosystemLogoUrl?.trim() || '';
  const preferredThemeLogo =
    resolvedTheme === 'dark' ? rootLogoDark : rootLogoLight;
  const fallbackThemeLogo =
    resolvedTheme === 'dark' ? rootLogoLight : rootLogoDark;
  const rootLogoUrl = [
    preferredThemeLogo,
    fallbackThemeLogo,
    rootLogoLegacy,
  ].find((candidate) => candidate && isSafeImageUrl(candidate));
  const rootTitle = rootSpace?.title?.trim() || '';
  const rootHasCustomLogo = hasCustomRootLogo(rootLogoUrl ?? '');
  const suppressDefaultLogo = aiChatEnabled && isSpaceRoute;

  const canRenderSpaceLogoNode =
    suppressDefaultLogo && (rootSpace || !isLoadingSpaces);
  const logoNode = canRenderSpaceLogoNode ? (
    rootSpace ? (
      rootHasCustomLogo && rootLogoUrl ? (
        <Link
          href={rootConfigHref ?? '#'}
          prefetch={true}
          className="group relative inline-flex h-9 max-w-[11rem] items-center justify-start overflow-hidden rounded-md px-1 transition-colors hover:bg-muted/40"
          aria-label={tNavigation('ecosystemLogo')}
          title={tNavigation('ecosystemLogo')}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={rootLogoUrl}
            alt={rootTitle || tNavigation('ecosystemLogo')}
            className="h-full w-auto object-contain"
          />
          <span className="pointer-events-none absolute bottom-0.5 right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-border/70 bg-background/85 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            <Pencil className="h-2.5 w-2.5" />
          </span>
        </Link>
      ) : (
        <Link
          href={rootConfigHref ?? '#'}
          prefetch={true}
          className="group relative inline-flex h-10 max-w-[13.5rem] items-center justify-center overflow-hidden rounded-xl border border-dashed border-accent-7/60 bg-linear-to-r from-accent-2/50 via-background-2 to-accent-2/40 px-3.5 text-sm font-semibold text-accent-11 shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset,0_8px_20px_-16px_var(--accent-9)] transition-all duration-200 hover:border-accent-8 hover:from-accent-3/60 hover:to-accent-3/50 hover:text-accent-12"
          aria-label={tNavigation('ecosystemLogo')}
          title={tNavigation('ecosystemLogo')}
        >
          <span className="absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 bg-linear-to-r from-transparent via-accent-4/20 to-transparent" />
          <span className="relative truncate">
            {tNavigation('ecosystemLogo')}
          </span>
          <span className="pointer-events-none absolute right-1.5 top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-border/70 bg-background/85 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            <Pencil className="h-2.5 w-2.5" />
          </span>
        </Link>
      )
    ) : undefined
  ) : undefined;

  return (
    <MenuTop
      logoHref={suppressDefaultLogo ? undefined : logoHref}
      logoNode={logoNode}
      hrefTarget={hrefTarget}
      openMenuLabel={openMenuLabel}
      closeMenuLabel={closeMenuLabel}
      leadingAction={leadingAction}
      trailingAction={trailingAction}
    >
      {children}
    </MenuTop>
  );
}
