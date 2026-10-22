'use client';

import { useJwt, type MemberIntelligence } from '@hypha-platform/core/client';
import type { Locale } from '@hypha-platform/i18n';
import useSWR from 'swr';

import { MemberHomeSpacesRail } from './member-home-spaces-rail';

/**
 * Vertical spaces rail (same as home) for messages, wallet, space, and network.
 * Fetches membership so those screens can switch space without living on home.
 */
export function MobileSpacesSubnav({
  lang,
  activeSlug,
  embedded = false,
}: {
  lang: Locale;
  activeSlug?: string | null;
  embedded?: boolean;
}) {
  const { jwt } = useJwt();

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

  const spaces = home?.spaces ?? [];

  return (
    <MemberHomeSpacesRail
      lang={lang}
      spaces={spaces}
      isLoading={isLoading && spaces.length === 0}
      activeSlug={activeSlug}
      embedded={embedded}
    />
  );
}
