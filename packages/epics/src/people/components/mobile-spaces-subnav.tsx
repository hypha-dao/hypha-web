'use client';

import type { Locale } from '@hypha-platform/i18n';

import { useMemberIntelligence } from '../../common/member-intelligence-swr';
import { MemberHomeSpacesRail } from './member-home-spaces-rail';

/**
 * Spaces rail for messages, wallet, space, and network.
 * Fetches membership so those screens can switch space without living on home.
 */
export function MobileSpacesSubnav({
  lang,
  activeSlug,
  embedded = false,
  layout = 'column',
}: {
  lang: Locale;
  activeSlug?: string | null;
  embedded?: boolean;
  /** Row sits under the header with the top-bar circle. Column fills the AI rail. */
  layout?: 'column' | 'row';
}) {
  const { data: home, isLoading } = useMemberIntelligence();

  const spaces = home?.spaces ?? [];

  return (
    <MemberHomeSpacesRail
      lang={lang}
      spaces={spaces}
      isLoading={isLoading && spaces.length === 0}
      activeSlug={activeSlug}
      embedded={embedded}
      layout={layout}
    />
  );
}
