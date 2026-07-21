'use client';

import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  DEFAULT_SPACE_LEAD_IMAGE,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import {
  CompactSpaceBanner,
  SpaceAccentFromImages,
  isSafeImageUrl,
  type CompactSpaceBannerWithStatsProps,
} from '@hypha-platform/epics';
import React from 'react';

type LiveSpaceHeroBannerProps = Omit<
  CompactSpaceBannerWithStatsProps,
  | 'showSpaceStats'
  | 'logoUrl'
  | 'leadImageUrl'
  | 'title'
  | 'description'
  | 'links'
> & {
  spaceSlug: string;
  title: string;
  description: string | null | undefined;
  logoUrl: string;
  leadImageUrl: string;
  links?: string[] | null;
  beforeBanner?: React.ReactNode;
  children?: React.ReactNode;
};

function resolveSafeImageUrl(
  candidate: string | null | undefined,
  fallback: string,
): string {
  const trimmed = candidate?.trim();
  if (trimmed && isSafeImageUrl(trimmed)) return trimmed;
  return isSafeImageUrl(fallback) ? fallback : fallback;
}

/**
 * Hero chrome that prefers live SWR space identity over the SSR snapshot so
 * logo/banner changes appear immediately after Configure Space saves.
 */
export function LiveSpaceHero({
  spaceSlug,
  title,
  description,
  logoUrl,
  leadImageUrl,
  links,
  beforeBanner,
  children,
  logoAlt: _logoAlt,
  ...bannerRest
}: LiveSpaceHeroBannerProps) {
  const { space: liveSpace } = useSpaceBySlug(spaceSlug);

  const resolvedTitle = liveSpace?.title?.trim() || title;
  const resolvedDescription =
    liveSpace?.description !== undefined ? liveSpace.description : description;
  const resolvedLinks = liveSpace?.links ?? links;
  const resolvedLogoUrl = resolveSafeImageUrl(
    liveSpace?.logoUrl ?? logoUrl,
    DEFAULT_SPACE_AVATAR_IMAGE,
  );
  const resolvedLeadImageUrl = resolveSafeImageUrl(
    liveSpace?.leadImage ?? leadImageUrl,
    DEFAULT_SPACE_LEAD_IMAGE,
  );

  return (
    <SpaceAccentFromImages
      bannerSrc={resolvedLeadImageUrl}
      logoSrc={resolvedLogoUrl}
      className="pt-0"
    >
      {beforeBanner}
      <CompactSpaceBanner
        key={`${resolvedLogoUrl}|${resolvedLeadImageUrl}|${resolvedTitle}`}
        {...bannerRest}
        showSpaceStats
        title={resolvedTitle}
        description={resolvedDescription}
        logoUrl={resolvedLogoUrl}
        logoAlt={resolvedTitle}
        links={resolvedLinks}
        leadImageUrl={resolvedLeadImageUrl}
      />
      {children}
    </SpaceAccentFromImages>
  );
}
