'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import useSWR from 'swr';
import { useJwt, type MemberIntelligence } from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import { Skeleton } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

import {
  readRecentSpaceSlugs,
  subscribeRecentSpaceSlugs,
} from '../../common/recent-space-history';
import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';
import { orderSpacesByRecentVisit } from './member-home-spaces-rail';

const AVATAR_PX = 36;

type HomeSpace = MemberIntelligence['spaces'][number];

/**
 * Horizontal space list for the mobile secondary bar — same avatars as the
 * home spaces rail, so space/network screens can switch without a section menu.
 */
export function MobileSpacesSubnav({
  lang,
  activeSlug,
}: {
  lang: Locale;
  activeSlug?: string | null;
}) {
  const t = useTranslations('MemberHome');
  const { jwt } = useJwt();
  const { resolvedTheme } = useTheme();
  const logoVariant = resolvedTheme === 'dark' ? 'dark' : 'light';
  const [recentSlugs, setRecentSlugs] = useState<string[]>(() =>
    readRecentSpaceSlugs(),
  );

  useEffect(() => subscribeRecentSpaceSlugs(setRecentSlugs), []);

  const { data: home, isLoading } = useSWR<MemberIntelligence | null>(
    jwt ? ['/api/v1/people/me/intelligence', jwt] : null,
    async ([url, token]) => {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return null;
      return (await response.json()) as MemberIntelligence;
    },
  );

  const orderedSpaces = useMemo(
    () => orderSpacesByRecentVisit(home?.spaces ?? [], recentSlugs),
    [home?.spaces, recentSlugs],
  );

  return (
    <div
      className="flex items-center gap-2 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      aria-label={t('spacesRail')}
    >
      {isLoading && orderedSpaces.length === 0 ? (
        Array.from({ length: 6 }, (_, index) => (
          <Skeleton
            key={index}
            loading
            width={`${AVATAR_PX}px`}
            height={`${AVATAR_PX}px`}
            className="shrink-0 rounded-full bg-foreground/10"
          />
        ))
      ) : orderedSpaces.length === 0 ? (
        <Link
          href={`/${lang}/my-spaces`}
          aria-label={t('openMySpaces')}
          className={cn(
            'grid shrink-0 place-items-center rounded-full border border-dashed border-border text-neutral-11',
            'hover:border-foreground hover:text-foreground',
          )}
          style={{ width: AVATAR_PX, height: AVATAR_PX }}
        >
          <LayoutGrid className="h-4 w-4" strokeWidth={1.5} aria-hidden />
        </Link>
      ) : (
        <>
          {orderedSpaces.map((space: HomeSpace) => {
            const iconUrl = resolveSpaceDisplayLogoUrl(space, logoVariant);
            const active = activeSlug === space.slug;
            return (
              <Link
                key={space.id}
                href={`/${lang}/dho/${space.slug}/overview`}
                aria-label={space.title}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative shrink-0 overflow-hidden rounded-full bg-neutral-3',
                  'ring-1 transition-[box-shadow]',
                  active
                    ? 'ring-foreground'
                    : 'ring-transparent hover:ring-foreground/60',
                )}
                style={{ width: AVATAR_PX, height: AVATAR_PX }}
              >
                {iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={iconUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span
                    className="flex h-full w-full items-center justify-center text-1 font-medium text-foreground"
                    aria-hidden
                  >
                    {space.title.trim().charAt(0).toUpperCase() || '?'}
                  </span>
                )}
              </Link>
            );
          })}
          <Link
            href={`/${lang}/my-spaces`}
            aria-label={t('openMySpaces')}
            className={cn(
              'grid shrink-0 place-items-center rounded-full border border-border text-neutral-11',
              'hover:border-foreground hover:text-foreground',
            )}
            style={{ width: AVATAR_PX, height: AVATAR_PX }}
          >
            <LayoutGrid className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          </Link>
        </>
      )}
    </div>
  );
}
