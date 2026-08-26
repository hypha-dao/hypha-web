'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { useAccessTokenReady } from '@hypha-platform/authentication';
import type { PaginatedResponse, Person } from '@hypha-platform/core/client';
import type { NetworkPerson } from './network-pulse';

function personDisplayName(person: Person): string {
  return (
    [person.name, person.surname].filter(Boolean).join(' ') ||
    person.nickname ||
    person.slug ||
    ''
  );
}

export function toNetworkPerson(person: Person): NetworkPerson | null {
  const slug = person.slug?.trim();
  if (!slug || person.networkVisible === false) return null;
  return {
    id: person.id,
    slug,
    name: personDisplayName(person) || slug,
    avatarUrl: person.avatarUrl ?? null,
    networkVisible: true,
  };
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
  const shouldFetch =
    scopedSlugs.length > 0 && !isAuthLoading && accessTokenReady;

  const { data, isLoading } = useSWR(
    shouldFetch
      ? [
          'network-people',
          scopedSlugs.join(','),
          excludeSlug ?? '',
          String(pageSize),
        ]
      : null,
    async () => {
      const token = await getAccessToken();
      const params = new URLSearchParams({
        spaceSlugs: scopedSlugs.join(','),
        page: '1',
        pageSize: String(pageSize),
      });
      if (excludeSlug?.trim()) params.set('excludeSlug', excludeSlug.trim());
      const response = await fetch(`/api/v1/network/people?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) return [] as NetworkPerson[];
      const page = (await response.json()) as PaginatedResponse<Person>;
      return (page.data ?? [])
        .map(toNetworkPerson)
        .filter((person): person is NetworkPerson => Boolean(person));
    },
    {
      revalidateOnFocus: true,
      refreshInterval: 60_000,
    },
  );

  return {
    people: data ?? ([] as NetworkPerson[]),
    isLoading: shouldFetch && isLoading,
  };
}
