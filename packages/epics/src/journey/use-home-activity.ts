'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { useAccessTokenReady } from '@hypha-platform/authentication';
import type { Coherence, Document } from '@hypha-platform/core/client';
import {
  HOME_ACTIVITY_ITEM_LIMIT,
  HOME_ACTIVITY_SPACE_LIMIT,
  sortVotes,
  votesFromDocuments,
  type HomeSignalItem,
  type HomeSpaceRef,
  type HomeVoteItem,
} from './home-activity';

type CoherencePage = {
  data?: Coherence[];
};

async function fetchJson<T>(
  url: string,
  headers: HeadersInit,
): Promise<T | null> {
  const response = await fetch(url, { headers });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

export function useHomeActivity(spaces: HomeSpaceRef[]) {
  const { getAccessToken, isAuthLoading, accessTokenReady } =
    useAccessTokenReady();
  const scopedSpaces = useMemo(
    () =>
      spaces
        .filter((space) => Boolean(space.slug))
        .slice(0, HOME_ACTIVITY_SPACE_LIMIT),
    [spaces],
  );
  const spaceKey = scopedSpaces.map((space) => space.slug).join(',');
  const shouldFetch =
    scopedSpaces.length > 0 && !isAuthLoading && accessTokenReady;

  const { data, isLoading } = useSWR(
    shouldFetch ? ['home-activity', spaceKey] : null,
    async () => {
      const token = await getAccessToken();
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const pages = await Promise.all(
        scopedSpaces.map(async (space) => {
          const [documents, signalsPage] = await Promise.all([
            fetchJson<Document[]>(
              `/api/v1/spaces/${encodeURIComponent(space.slug)}/documents/all`,
              headers,
            ),
            fetchJson<CoherencePage>(
              `/api/v1/spaces/${encodeURIComponent(
                space.slug,
              )}/coherences?page=1&pageSize=8&orderBy=mostrecent`,
              headers,
            ),
          ]);

          const votes = votesFromDocuments(documents ?? [], space);
          const signals: HomeSignalItem[] = (signalsPage?.data ?? [])
            .filter((signal) => !signal.archived)
            .map((signal) => ({
              id: `${space.slug}:${signal.id}`,
              title: signal.title,
              spaceSlug: space.slug,
              spaceTitle: space.title,
              signalSlug: signal.slug,
            }));

          return { votes, signals };
        }),
      );

      return {
        votes: sortVotes(pages.flatMap((page) => page.votes)).slice(
          0,
          HOME_ACTIVITY_ITEM_LIMIT,
        ),
        signals: pages
          .flatMap((page) => page.signals)
          .slice(0, HOME_ACTIVITY_ITEM_LIMIT),
      };
    },
    {
      revalidateOnFocus: true,
      refreshInterval: 60_000,
    },
  );

  return {
    votes: data?.votes ?? ([] as HomeVoteItem[]),
    signals: data?.signals ?? ([] as HomeSignalItem[]),
    isLoading: shouldFetch && isLoading,
  };
}
