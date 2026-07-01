'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import useSWR, { mutate } from 'swr';
import type { PaginatedResponse } from '@hypha-platform/core/client';
import { CoherenceType } from '../../coherence-types';
import { CoherenceTag } from '../../coherence-tags';
import { CoherencePriority } from '../../coherence-priorities';
import type { Coherence } from '../../types';

export interface CoherenceQuery {
  spaceSlug?: string;
  search?: string;
  type?: CoherenceType;
  tags?: CoherenceTag[];
  priority?: CoherencePriority;
  includeArchived?: boolean;
  orderBy?: 'mostrecent' | 'mostmessages' | 'mostviews';
}

const COHERENCES_REFRESH_MS = 60_000;
const COHERENCES_PAGE_SIZE = 100;

export const COHERENCES_SWR_KEY = 'coherences' as const;

/** Revalidate signal lists for a space (e.g. after create, edit, or delete). */
export function revalidateCoherences(spaceSlug?: string) {
  const normalizedSlug = spaceSlug?.trim() || null;
  return mutate(
    (key: unknown) =>
      Array.isArray(key) &&
      key[0] === COHERENCES_SWR_KEY &&
      (normalizedSlug == null || key[1] === normalizedSlug),
    undefined,
    { revalidate: true },
  );
}

/** Merge a patched signal into the local SWR list without a full refetch. */
export async function upsertCoherenceInSpaceCache(
  spaceSlug: string,
  updated: Coherence,
): Promise<boolean> {
  const trimmedSpaceSlug = spaceSlug.trim();
  const updatedSlug = updated.slug?.trim();
  if (!trimmedSpaceSlug || !updatedSlug) return false;

  let didUpdate = false;

  await mutate(
    (key) =>
      Array.isArray(key) &&
      key[0] === COHERENCES_SWR_KEY &&
      key[1] === trimmedSpaceSlug,
    (current) => {
      if (!current?.length) return current;
      let found = false;
      const next = current.map((item) => {
        const itemSlug = item.slug?.trim();
        if (itemSlug !== updatedSlug) return item;
        found = true;
        return { ...item, ...updated };
      });
      if (found) didUpdate = true;
      return found ? next : current;
    },
    { revalidate: false },
  );

  return didUpdate;
}

function buildCoherencesUrl(
  spaceSlug: string,
  query: Omit<CoherenceQuery, 'spaceSlug'>,
  page: number,
): string {
  const params = new URLSearchParams();
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.type) params.set('type', query.type);
  if (query.tags?.length) {
    for (const tag of query.tags) {
      params.append('tags', tag);
    }
  }
  if (query.priority) params.set('priority', query.priority);
  if (query.includeArchived) params.set('includeArchived', 'true');
  if (query.orderBy) params.set('orderBy', query.orderBy);
  params.set('page', String(page));
  params.set('pageSize', String(COHERENCES_PAGE_SIZE));
  const qs = params.toString();
  return `/api/v1/spaces/${encodeURIComponent(spaceSlug)}/coherences${
    qs ? `?${qs}` : ''
  }`;
}

async function fetchAllCoherences(
  spaceSlug: string,
  query: Omit<CoherenceQuery, 'spaceSlug'>,
  getAccessToken: () => Promise<string | null>,
): Promise<Coherence[]> {
  const headers: HeadersInit = {};
  const token = await getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const all: Coherence[] = [];
  let page = 1;

  while (true) {
    const url = buildCoherencesUrl(spaceSlug, query, page);
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch coherences: ${response.status}`);
    }
    const payload = (await response.json()) as PaginatedResponse<Coherence>;
    all.push(...payload.data);
    if (!payload.pagination.hasNextPage) break;
    page += 1;
  }

  return all;
}

export const useFindCoherences = ({
  spaceSlug,
  search,
  type,
  tags,
  priority,
  includeArchived,
  orderBy,
}: CoherenceQuery) => {
  const { getAccessToken } = useAuthentication();
  const slug = spaceSlug?.trim() || null;

  const swrKey = slug
    ? ([
        COHERENCES_SWR_KEY,
        slug,
        search ?? '',
        type ?? '',
        (tags ?? []).join(','),
        priority ?? '',
        includeArchived ? '1' : '0',
        orderBy ?? 'mostrecent',
      ] as const)
    : null;

  const {
    data: coherences,
    isLoading,
    error,
    mutate: refresh,
  } = useSWR(
    swrKey,
    async ([, resolvedSlug]) =>
      fetchAllCoherences(
        resolvedSlug,
        {
          search,
          type,
          tags,
          priority,
          includeArchived,
          orderBy,
        },
        getAccessToken,
      ),
    {
      refreshInterval: COHERENCES_REFRESH_MS,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      revalidateOnFocus: true,
      keepPreviousData: true,
      shouldRetryOnError: (err) => {
        if (err instanceof Error && err.message.includes('404')) return false;
        return true;
      },
      errorRetryCount: 2,
    },
  );

  return {
    coherences,
    isLoading,
    error,
    refresh,
  };
};
