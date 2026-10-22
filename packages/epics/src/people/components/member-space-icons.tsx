'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  Address,
  DEFAULT_SPACE_AVATAR_IMAGE,
  Space,
  useSpacesByWeb3Ids,
} from '@hypha-platform/core/client';
import { Image, Skeleton } from '@hypha-platform/ui';
import { Locale } from '@hypha-platform/i18n';
import { getDhoPathDefaultLanding } from '../../common/get-path-function';
import { filterSpaces } from '../../spaces/components/my-filtered-spaces';
import { useMemberWeb3SpaceIds } from '../../spaces/hooks/use-member-web3-space-ids';

const MAX_VISIBLE_SPACES = 5;

export type MemberSpaceIconItem = {
  slug?: string | null;
  title: string;
  logoUrl?: string | null;
};

export type MemberSpaceIconsProps = {
  spaces: MemberSpaceIconItem[];
  /** Opens the member profile aside with the full space list. */
  overflowHref?: string | null;
  size?: number;
  isLoading?: boolean;
  className?: string;
};

/** Compact space logos — at most five, then +N into the member pop-up. */
export function MemberSpaceIcons({
  spaces,
  overflowHref,
  size = 28,
  isLoading = false,
  className,
}: MemberSpaceIconsProps) {
  const tCommon = useTranslations('Common');
  const { lang } = useParams<{ lang: Locale }>();
  const visible = spaces.slice(0, MAX_VISIBLE_SPACES);
  const overflow = Math.max(0, spaces.length - visible.length);

  if (isLoading) {
    return (
      <div
        className={`flex items-center gap-1.5 ${className ?? ''}`}
        aria-hidden
      >
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton
            key={index}
            width={`${size}px`}
            height={`${size}px`}
            loading
            className="rounded-full"
          />
        ))}
      </div>
    );
  }

  if (spaces.length === 0) return null;

  return (
    <div
      className={`flex min-w-0 items-center gap-1.5 ${className ?? ''}`}
      aria-label={tCommon('Spaces')}
    >
      <div className="flex min-w-0 items-center -space-x-1.5">
        {visible.map((space, index) => {
          const logo = (
            <span
              title={space.title}
              className="relative inline-flex shrink-0 overflow-hidden rounded-full border border-border/70 bg-background"
              style={{ width: size, height: size }}
            >
              <Image
                className="aspect-square h-full w-full object-cover"
                width={size}
                height={size}
                src={space.logoUrl?.trim() || DEFAULT_SPACE_AVATAR_IMAGE}
                alt={space.title}
              />
            </span>
          );
          if (!space.slug) {
            return (
              <span key={`${space.title}-${index}`} className="relative z-[1]">
                {logo}
              </span>
            );
          }
          return (
            <Link
              key={space.slug}
              href={getDhoPathDefaultLanding(lang, space.slug)}
              title={space.title}
              aria-label={space.title}
              className="relative z-[1] inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              {logo}
            </Link>
          );
        })}
      </div>
      {overflow > 0 ? (
        overflowHref ? (
          <Link
            href={overflowHref}
            scroll={false}
            className="shrink-0 text-1 font-medium text-muted-foreground hover:text-foreground hover:underline"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            +{overflow}
          </Link>
        ) : (
          <span className="shrink-0 text-1 font-medium text-muted-foreground">
            +{overflow}
          </span>
        )
      ) : null}
    </div>
  );
}

/** Loads a person's spaces for the compact icon strip. Prefers web3 ids; falls back to the people spaces API by slug. */
export function usePersonMemberSpaces({
  personAddress,
  personSlug,
}: {
  personAddress?: Address | string | null;
  personSlug?: string | null;
}) {
  const { getAccessToken } = useAuthentication();
  const address = personAddress as Address | undefined;
  const slug = personSlug?.trim() || null;
  const { web3SpaceIds, isLoading: isLoadingIds } = useMemberWeb3SpaceIds({
    personAddress: address,
  });
  const { spaces, isLoading: isLoadingSpaces } = useSpacesByWeb3Ids(
    web3SpaceIds ?? [],
  );
  const filtered = useMemo(
    () => filterSpaces(spaces ?? [], slug ?? undefined, web3SpaceIds),
    [slug, spaces, web3SpaceIds],
  );

  const needsSlugFetch = Boolean(slug) && !address;
  const { data: slugSpaces = [], isLoading: isLoadingSlugSpaces } = useSWR<
    Space[]
  >(
    needsSlugFetch ? ['member-space-icons', slug] : null,
    async ([, person]: [string, string]) => {
      const token = await getAccessToken();
      if (!token) return [];
      const res = await fetch(`/api/v1/people/${person}/spaces`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) return [];
      return (await res.json()) as Space[];
    },
  );

  if (address) {
    return {
      spaces: filtered as Space[],
      isLoading: isLoadingIds || isLoadingSpaces,
    };
  }

  return {
    spaces: slugSpaces,
    isLoading: needsSlugFetch && isLoadingSlugSpaces,
  };
}

export function memberProfileAsideHref({
  lang,
  hostSpaceSlug,
  personSlug,
  fallbackSpaceSlug,
}: {
  lang: string;
  hostSpaceSlug?: string | null;
  personSlug?: string | null;
  fallbackSpaceSlug?: string | null;
}): string | null {
  if (!personSlug) return null;
  const space = hostSpaceSlug?.trim() || fallbackSpaceSlug?.trim();
  if (!space) return `/${lang}/profile/${encodeURIComponent(personSlug)}`;
  return `/${lang}/dho/${space}/members/person/${encodeURIComponent(
    personSlug,
  )}`;
}
