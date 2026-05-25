'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import useSWR from 'swr';
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

function buildCoherencesUrl(
  spaceSlug: string,
  query: Omit<CoherenceQuery, 'spaceSlug' | 'tags'>,
): string {
  const params = new URLSearchParams();
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.type) params.set('type', query.type);
  if (query.priority) params.set('priority', query.priority);
  if (query.includeArchived) params.set('includeArchived', 'true');
  if (query.orderBy) params.set('orderBy', query.orderBy);
  const qs = params.toString();
  return `/api/v1/spaces/${encodeURIComponent(spaceSlug)}/coherences${
    qs ? `?${qs}` : ''
  }`;
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
    async ([, resolvedSlug]) => {
      const url = buildCoherencesUrl(resolvedSlug, {
        search,
        type,
        priority,
        includeArchived,
        orderBy,
      });
      const token = await getAccessToken();
      const headers: HeadersInit = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Failed to fetch coherences: ${response.status}`);
      }
      return (await response.json()) as Coherence[];
    },
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
