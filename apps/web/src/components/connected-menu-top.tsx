'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MenuTop } from '@hypha-platform/ui';
import {
  getDhoSpaceSlugFromPathname,
  getRootSpace,
  isSafeImageUrl,
  useAiPanel,
  AiPanelTrigger,
  AiSidebarTrigger,
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
  mobileAction?: ReactNode;
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
  mobileAction,
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
  const params = useParams<{ lang?: string }>();
  const lang = typeof params.lang === 'string' ? params.lang : 'en';
  const activeSpaceSlug = useMemo(
    () => getDhoSpaceSlugFromPathname(pathname),
    [pathname],
  );
  const isSpaceRoute = Boolean(activeSpaceSlug);
  const { data: activeSpace, isLoading: isLoadingActiveSpace } =
    useSWR<Space | null>(
      activeSpaceSlug ? `/api/v1/spaces/${activeSpaceSlug}` : null,
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
          return null;
        }
        return (await response.json()) as Space;
      },
    );
  const {
    data: organisationSpaces = [],
    isLoading: isLoadingOrganisationSpaces,
  } = useSWR<Space[]>(
    activeSpaceSlug ? `/api/v1/spaces/${activeSpaceSlug}/organisation` : null,
    async (url: string) => {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (!response.ok) {
        console.warn('[ConnectedMenuTop] organisation spaces fetch failed', {
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
    const activeSpaceFromOrg =
      organisationSpaces.find((space) => space.slug === activeSpaceSlug) ??
      null;
    return getRootSpace(
      activeSpace ?? activeSpaceFromOrg ?? undefined,
      organisationSpaces,
    );
  }, [activeSpace, activeSpaceSlug, organisationSpaces]);
  const rootSpaceHref =
    rootSpace?.slug != null
      ? `/${lang}/dho/${rootSpace.slug}/agreements/space-configuration`
      : logoHref;
  useEffect(() => {
    if (!rootSpaceHref || rootSpaceHref === '#') return;
    router.prefetch(rootSpaceHref);
  }, [rootSpaceHref, router]);
  const rootPrimaryLogo = rootSpace?.logoUrl?.trim() || '';
  const rootLogoLight = rootSpace?.ecosystemLogoUrlLight?.trim() || '';
  const rootLogoDark = rootSpace?.ecosystemLogoUrlDark?.trim() || '';
  const preferredThemeLogo =
    resolvedTheme === 'dark' ? rootLogoDark : rootLogoLight;
  const fallbackThemeLogo =
    resolvedTheme === 'dark' ? rootLogoLight : rootLogoDark;
  // Prefer ecosystem logos so new uploads immediately replace generic placeholders.
  const rootLogoUrl = [preferredThemeLogo, fallbackThemeLogo, rootPrimaryLogo]
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate && isSafeImageUrl(candidate));
  const rootTitle = rootSpace?.title?.trim() || '';
  const ecosystemLogoLabel = tNavigation('ecosystemLogo');
  const logoA11yLabel = rootTitle
    ? `${rootTitle} ${ecosystemLogoLabel}`
    : ecosystemLogoLabel;
  const rootHasCustomLogo = hasCustomRootLogo(rootLogoUrl ?? '');
  const suppressDefaultLogo = aiChatEnabled && isSpaceRoute;
  const { overlayVisible } = useAiPanel();

  const resolvedLeadingAction = aiChatEnabled ? (
    <div className="flex items-center gap-2">
      {!overlayVisible ? (
        <div className="md:hidden">
          <AiSidebarTrigger />
        </div>
      ) : null}
      <AiPanelTrigger />
    </div>
  ) : (
    leadingAction
  );

  const canRenderSpaceLogoNode =
    suppressDefaultLogo &&
    (Boolean(rootSpace) || isLoadingActiveSpace || isLoadingOrganisationSpaces);
  const logoNode = canRenderSpaceLogoNode ? (
    rootSpace ? (
      rootHasCustomLogo && rootLogoUrl ? (
        <Link
          href={rootSpaceHref ?? '#'}
          prefetch={true}
          className="group relative -ml-0.5 inline-flex h-9 max-w-[12rem] items-center justify-start overflow-hidden rounded-md px-0.5 transition-colors hover:bg-muted/40"
          aria-label={logoA11yLabel}
          title={logoA11yLabel}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={rootLogoUrl}
            alt={rootTitle || tNavigation('ecosystemLogo')}
            loading="eager"
            className="max-h-8 w-auto bg-transparent object-contain"
          />
          <span className="pointer-events-none absolute bottom-0.5 right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-border/70 bg-background/85 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            <Pencil className="h-2.5 w-2.5" />
          </span>
        </Link>
      ) : (
        <Link
          href={rootSpaceHref ?? '#'}
          prefetch={true}
          className="group relative -ml-0.5 inline-flex h-9 max-w-[13.5rem] items-center justify-center overflow-hidden rounded-md border border-border/70 bg-background px-3.5 text-sm font-semibold text-muted-foreground shadow-sm transition-[background-color,border-color,box-shadow,color] duration-200 hover:border-border hover:bg-muted/40 hover:text-foreground hover:shadow-md"
          aria-label={logoA11yLabel}
          title={logoA11yLabel}
        >
          <span className="relative truncate">
            {rootTitle
              ? `${rootTitle} · ${tNavigation('ecosystemLogo')}`
              : tNavigation('ecosystemLogo')}
          </span>
          <span className="pointer-events-none absolute right-1.5 top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-border/70 bg-background/85 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            <Pencil className="h-2.5 w-2.5" />
          </span>
        </Link>
      )
    ) : (
      <span
        className="-ml-0.5 inline-flex h-9 w-[12rem]"
        aria-hidden
        title={tNavigation('ecosystemLogo')}
      />
    )
  ) : undefined;
  const useReplacementLogoNode =
    Boolean(logoNode) && !(overlayVisible && isSpaceRoute);

  return (
    <MenuTop
      logoHref={useReplacementLogoNode ? undefined : logoHref}
      logoNode={useReplacementLogoNode ? logoNode : undefined}
      hrefTarget={hrefTarget}
      openMenuLabel={openMenuLabel}
      closeMenuLabel={closeMenuLabel}
      leadingAction={resolvedLeadingAction}
      trailingAction={trailingAction}
      mobileAction={mobileAction}
      showMobileHamburger={false}
    >
      {children}
    </MenuTop>
  );
}
