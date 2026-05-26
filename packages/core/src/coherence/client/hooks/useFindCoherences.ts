'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import useSWR from 'swr';
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
        'coherences',
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
