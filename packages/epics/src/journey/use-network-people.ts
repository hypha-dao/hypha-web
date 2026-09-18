'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { useAccessTokenReady } from '@hypha-platform/authentication';
import type { PaginatedResponse, Person } from '@hypha-platform/core/client';
import { networkPeopleCacheKey, toNetworkPerson } from './network-people';
import {
  NETWORK_PULSE_PEOPLE_SPACE_LIMIT,
  uniquePeople,
  type NetworkPerson,
} from './network-pulse';

const MEMBERS_FALLBACK_PAGE_SIZE = 20;

export {
  networkPeopleCacheKey,
  personAvatarUrl,
  toNetworkPerson,
} from './network-people';
export type { PersonDirectorySource } from './network-people';

type MembersPage = { persons?: { data?: Person[] } };

async function fetchDirectoryPeople({
  token,
  spaceSlugs,
  excludeSlug,
  pageSize,
}: {
  token: string | null;
  spaceSlugs: string[];
  excludeSlug?: string | null;
  pageSize: number;
}): Promise<NetworkPerson[]> {
  const params = new URLSearchParams({
    spaceSlugs: spaceSlugs.join(','),
    page: '1',
    pageSize: String(pageSize),
  });
  if (excludeSlug?.trim()) params.set('excludeSlug', excludeSlug.trim());
  const response = await fetch(`/api/v1/network/people?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error(`network-people ${response.status}`);
  }
  const page = (await response.json()) as PaginatedResponse<Person>;
  return (page.data ?? [])
    .map(toNetworkPerson)
    .filter((person): person is NetworkPerson => Boolean(person));
}

async function fetchMembersFallbackPeople({
  token,
  spaceSlugs,
  excludeSlug,
  limit,
}: {
  token: string | null;
  spaceSlugs: string[];
  excludeSlug?: string | null;
  limit: number;
}): Promise<NetworkPerson[]> {
  if (spaceSlugs.length === 0) return [];
  const headers: HeadersInit = token
    ? { Authorization: `Bearer ${token}` }
    : {};
  const pages = await Promise.all(
    spaceSlugs.slice(0, NETWORK_PULSE_PEOPLE_SPACE_LIMIT).map(async (slug) => {
      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(
          slug,
        )}/members?page=1&pageSize=${MEMBERS_FALLBACK_PAGE_SIZE}`,
        { headers },
      );
      if (!response.ok) return [] as Person[];
      const page = (await response.json()) as MembersPage;
      return page.persons?.data ?? [];
    }),
  );
  return uniquePeople(
    pages.flatMap((members) =>
      members
        .map(toNetworkPerson)
        .filter((person): person is NetworkPerson => Boolean(person)),
    ),
    excludeSlug,
    limit,
  );
}

export function useNetworkPeople({
  spaceSlugs,
  excludeSlug,
  pageSize = 40,
}: {
  spaceSlugs: string[];
  excludeSlug?: string | null;
  pageSize?: number;
}) {
  const { getAccessToken, isAuthLoading, accessTokenReady } =
    useAccessTokenReady();
  const scopedSlugs = useMemo(
    () =>
      [...new Set(spaceSlugs.map((slug) => slug.trim()).filter(Boolean))].slice(
        0,
        24,
      ),
    [spaceSlugs],
  );
  const awaitingAuth = isAuthLoading || !accessTokenReady;
  const cacheKey = networkPeopleCacheKey({
    awaitingAuth,
    spaceSlugs: scopedSlugs,
    excludeSlug,
    pageSize,
  });

  const { data, error, isLoading, mutate } = useSWR(
    cacheKey,
    async () => {
      const token = await getAccessToken();
      let directoryError: unknown;
      try {
        const directory = await fetchDirectoryPeople({
          token,
          spaceSlugs: scopedSlugs,
          excludeSlug,
          pageSize,
        });
        if (directory.length > 0) return directory;
      } catch (error) {
        directoryError = error;
      }
      const fallback = await fetchMembersFallbackPeople({
        token,
        spaceSlugs: scopedSlugs,
        excludeSlug,
        limit: pageSize,
      });
      if (fallback.length > 0) return fallback;
      if (directoryError) throw directoryError;
      return [] as NetworkPerson[];
    },
    {
      revalidateOnFocus: true,
      refreshInterval: 60_000,
    },
  );

  return {
    people: data ?? ([] as NetworkPerson[]),
    isLoading: awaitingAuth || (Boolean(cacheKey) && isLoading),
    error: Boolean(error) && (data?.length ?? 0) === 0,
    retry: () => {
      void mutate();
    },
  };
}
