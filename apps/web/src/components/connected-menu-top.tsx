'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MenuTop } from '@hypha-platform/ui';
import {
  getDhoSpaceSlugFromPathname,
  getRootSpace,
  isSafeImageUrl,
  toNextImageOptimizerSrc,
  AiPanelTrigger,
  SpacesRailTopToggle,
  useSpacesRailControl,
} from '@hypha-platform/epics';
import useSWR from 'swr';
import { fetchJson, type Space } from '@hypha-platform/core/client';
import Image from 'next/image';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { Pencil } from 'lucide-react';

/** Shared marks. A stored copy of either is not this space's own icon. */
const HYPHA_PLACEHOLDER_LOGOS = new Set([
  '/placeholder/space-avatar-image.svg',
  '/placeholder/space-lead-image.webp',
]);

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

const EMPTY_SPACES: Space[] = [];

function hasCustomRootLogo(logoUrl: string): boolean {
  const trimmed = logoUrl.trim();
  return trimmed.length > 0 && !HYPHA_PLACEHOLDER_LOGOS.has(trimmed);
}

function RootSpaceLogoImage({
  rootLogoUrl,
  alt,
}: {
  rootLogoUrl: string;
  alt: string;
}) {
  const [failedOptimized, setFailedOptimized] = useState(false);
  const optimized = toNextImageOptimizerSrc(rootLogoUrl, 384, 70);
  return (
    <Image
      src={failedOptimized ? rootLogoUrl : optimized}
      alt={alt}
      width={192}
      height={28}
      sizes="192px"
      quality={70}
      priority
      unoptimized
      className="max-h-[28px] w-auto bg-transparent object-contain"
      onError={() => {
        if (!failedOptimized && optimized !== rootLogoUrl) {
          setFailedOptimized(true);
        }
      }}
    />
  );
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
  const {
    data: activeSpace,
    isLoading: spaceLoading,
    error: spaceError,
  } = useSWR<Space>(
    activeSpaceSlug ? `/api/v1/spaces/${activeSpaceSlug}` : null,
    (url: string) => fetchJson<Space>(url, { cache: 'no-store' }, 'space'),
  );
  const {
    data: organisationSpaces,
    isLoading: organisationLoading,
    error: organisationError,
  } = useSWR<Space[]>(
    activeSpaceSlug ? `/api/v1/spaces/${activeSpaceSlug}/organisation` : null,
    (url: string) =>
      fetchJson<Space[]>(url, { cache: 'no-store' }, 'organisation spaces'),
  );
  const organisationList = organisationSpaces ?? EMPTY_SPACES;
  const rootSpace = useMemo(() => {
    if (!activeSpaceSlug) return null;
    const activeSpaceFromOrg =
      organisationList.find((space) => space.slug === activeSpaceSlug) ?? null;
    return getRootSpace(
      activeSpace ?? activeSpaceFromOrg ?? undefined,
      organisationList,
    );
  }, [activeSpace, activeSpaceSlug, organisationList]);
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
    .find(
      (candidate) =>
        candidate &&
        isSafeImageUrl(candidate) &&
        !HYPHA_PLACEHOLDER_LOGOS.has(candidate),
    );
  const rootTitle = rootSpace?.title?.trim() || '';
  const ecosystemLogoLabel = tNavigation('ecosystemLogo');
  const logoA11yLabel = rootTitle
    ? `${rootTitle} ${ecosystemLogoLabel}`
    : ecosystemLogoLabel;
  const rootHasCustomLogo = hasCustomRootLogo(rootLogoUrl ?? '');
  const suppressDefaultLogo = aiChatEnabled && isSpaceRoute;
  // A failed lookup used to be stored as "no space", which left the Hypha
  // wordmark in place. Keep that wordmark off while the root icon is in flight.
  const rootLogoPending =
    suppressDefaultLogo &&
    !rootSpace &&
    (spaceLoading ||
      organisationLoading ||
      Boolean(spaceError) ||
      Boolean(organisationError));

  const secondaryLeading = aiChatEnabled ? <AiPanelTrigger /> : leadingAction;
  const { active: spacesRailActive } = useSpacesRailControl();
  const onHome = /\/(?:home|my-dashboard)\/?$/.test(pathname ?? '');
  const resolvedLeadingAction =
    spacesRailActive || secondaryLeading ? (
      <div
        className={`flex items-center gap-1.5 sm:gap-2${
          secondaryLeading || onHome ? '' : ' xl:hidden'
        }`}
      >
        <SpacesRailTopToggle />
        {secondaryLeading}
      </div>
    ) : undefined;

  const canRenderSpaceLogoNode = suppressDefaultLogo && Boolean(rootSpace);
  const logoNode =
    canRenderSpaceLogoNode && rootSpace ? (
      rootHasCustomLogo && rootLogoUrl ? (
        <Link
          href={rootSpaceHref ?? '#'}
          prefetch={true}
          className="group relative inline-flex h-[36px] max-w-[min(10.5rem,36vw)] items-center justify-start overflow-hidden rounded-chrome px-0.5 transition-colors hover:bg-muted/40 sm:max-w-[12rem]"
          aria-label={logoA11yLabel}
          title={logoA11yLabel}
        >
          <RootSpaceLogoImage
            rootLogoUrl={rootLogoUrl}
            alt={rootTitle || tNavigation('ecosystemLogo')}
          />
          <span className="pointer-events-none absolute bottom-0.5 right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-border/70 bg-background/85 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            <Pencil className="h-2.5 w-2.5" />
          </span>
        </Link>
      ) : (
        <Link
          href={rootSpaceHref ?? '#'}
          prefetch={true}
          className="group relative inline-flex h-[36px] max-w-[min(11rem,40vw)] items-center justify-center overflow-hidden rounded-chrome border border-border/70 bg-background px-2.5 text-sm font-semibold text-muted-foreground transition-[background-color,border-color,color] duration-200 hover:border-border hover:bg-muted/40 hover:text-foreground sm:max-w-[13.5rem] sm:px-3.5"
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
    ) : undefined;
  const pendingLogoNode = rootLogoPending ? (
    <span
      className="inline-flex h-[36px] w-[7.5rem]"
      aria-hidden
      title={tNavigation('ecosystemLogo')}
    />
  ) : undefined;
  // The Hypha wordmark is the brand mark. Inside a space the header shows
  // that space's root icon instead, including while the icon is still loading
  // and when the left menu is open.
  const useReplacementLogoNode = Boolean(logoNode) || Boolean(pendingLogoNode);

  return (
    <MenuTop
      logoHref={useReplacementLogoNode ? undefined : logoHref}
      logoNode={
        useReplacementLogoNode ? logoNode ?? pendingLogoNode : undefined
      }
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
