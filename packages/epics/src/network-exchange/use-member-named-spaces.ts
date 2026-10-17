'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { useMe, type Address, type Space } from '@hypha-platform/core/client';
import { useMemberWeb3SpaceIds } from '../spaces/hooks/use-member-web3-space-ids';

export type MemberNamedSpace = {
  slug: string;
  title: string;
  logoUrl?: string | null;
  ecosystemLogoUrlLight?: string | null;
  ecosystemLogoUrlDark?: string | null;
};

const SLUG = /^[a-z0-9_-]{1,80}$/i;

/** Spaces the member belongs to on-chain — same source as My Spaces. */
export function useMemberNamedSpaces(): MemberNamedSpace[] {
  const { person } = useMe();
  const { web3SpaceIds } = useMemberWeb3SpaceIds({
    personAddress: person?.address as Address | undefined,
  });
  const { data: allSpaces = [] } = useSWR<Space[]>(
    '/api/v1/spaces?parentOnly=false',
    async (url: string) => {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Failed to load spaces: ${response.status}`);
      }
      return (await response.json()) as Space[];
    },
  );

  return useMemo(() => {
    const memberSpaceIds = new Set(
      (web3SpaceIds ?? []).map((id) => id.toString()),
    );
    return allSpaces
      .filter((space) => {
        if (!space.slug || !space.title || !SLUG.test(space.slug)) return false;
        if (space.web3SpaceId == null) return false;
        return memberSpaceIds.has(String(space.web3SpaceId));
      })
      .map((space) => ({
        slug: space.slug as string,
        title: space.title as string,
        logoUrl: space.logoUrl,
        ecosystemLogoUrlLight: space.ecosystemLogoUrlLight,
        ecosystemLogoUrlDark: space.ecosystemLogoUrlDark,
      }))
      .sort((left, right) => left.title.localeCompare(right.title));
  }, [allSpaces, web3SpaceIds]);
}
