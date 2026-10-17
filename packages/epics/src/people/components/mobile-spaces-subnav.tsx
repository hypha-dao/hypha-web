'use client';

import { useEffect, useMemo, useState } from 'react';
import { useJwt, type MemberIntelligence } from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import useSWR from 'swr';

import {
  readRecentSpaceSlugs,
  subscribeRecentSpaceSlugs,
} from '../../common/recent-space-history';
import {
  MemberHomeSpacesRail,
  orderSpacesByRecentVisit,
} from './member-home-spaces-rail';

/**
 * Vertical spaces rail (same as home) for messages, wallet, space, and network.
 * Fetches membership so those screens can switch space without living on home.
 */
export function MobileSpacesSubnav({
  lang,
  activeSlug,
}: {
  lang: Locale;
  activeSlug?: string | null;
}) {
  const { jwt } = useJwt();
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
    <MemberHomeSpacesRail
      lang={lang}
      spaces={orderedSpaces}
      isLoading={isLoading && orderedSpaces.length === 0}
      activeSlug={activeSlug}
    />
  );
}
