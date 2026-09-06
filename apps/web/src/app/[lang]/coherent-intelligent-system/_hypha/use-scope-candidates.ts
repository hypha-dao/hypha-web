'use client';

import { useMemo } from 'react';

import type { Address } from '@hypha-platform/core/client';
import {
  useMemberWeb3SpaceIds,
  useSpacesByWeb3IdsClient,
} from '@hypha-platform/epics';
import type { ScopeCandidate } from '@hypha-platform/epics';

const EMPTY_IDS: readonly bigint[] = [];

/**
 * Cap on how many spaces we surface — keeps the selector usable and bounds the
 * `knownSpaces` payload / prompt list. Must stay <= the server schema's
 * `knownSpaces` max.
 */
const MAX_CANDIDATES = 50;

/**
 * #2486 M7 — the spaces the member can scope the conversation to.
 *
 * Two sources, recents first: recently-visited slugs from the classic app
 * (strong "what I was just looking at" signal, but slug-only), then the
 * person's on-chain memberships (same resolution as `/my-spaces` —
 * `useMemberWeb3SpaceIds` → `useSpacesByWeb3IdsClient`), which carry real
 * titles so the selector labels and `set_scope` name-matching both work.
 * Deduped by slug; whichever appears first keeps its entry (a recent slug
 * that's also a membership keeps the membership title if the recent had none).
 * Capped at `MAX_CANDIDATES` so a member of many spaces doesn't blow the
 * `knownSpaces` payload / prompt list.
 *
 * In the talk-first UX the member rarely "visits" spaces the classic way, so
 * memberships are usually the whole list.
 */
export function useScopeCandidates({
  personAddress,
  recentSpaceSlugs,
}: {
  personAddress?: string;
  recentSpaceSlugs: string[];
}): { candidates: ScopeCandidate[]; isLoading: boolean } {
  const { web3SpaceIds, isLoading: isLoadingIds } = useMemberWeb3SpaceIds({
    personAddress: personAddress as Address | undefined,
  });

  const { spaces: memberSpaces, isLoading: isLoadingSpaces } =
    useSpacesByWeb3IdsClient(web3SpaceIds ?? EMPTY_IDS, false);

  const candidates = useMemo<ScopeCandidate[]>(() => {
    const bySlug = new Map<string, ScopeCandidate>();

    for (const raw of recentSpaceSlugs) {
      const slug = raw?.trim();
      if (!slug || bySlug.has(slug)) continue;
      bySlug.set(slug, { slug, source: 'recent' });
    }
    for (const space of memberSpaces) {
      const slug = space.slug?.trim();
      if (!slug) continue;
      const title = space.title?.trim();
      const existing = bySlug.get(slug);
      if (existing) {
        // Keep position, enrich a title-less recent with the membership title.
        if (!existing.title && title) existing.title = title;
        continue;
      }
      bySlug.set(slug, {
        slug,
        ...(title ? { title } : {}),
        source: 'membership',
      });
    }

    return Array.from(bySlug.values()).slice(0, MAX_CANDIDATES);
  }, [memberSpaces, recentSpaceSlugs]);

  return {
    candidates,
    isLoading: Boolean(personAddress) && (isLoadingIds || isLoadingSpaces),
  };
}
