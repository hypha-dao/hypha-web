'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { useAccessTokenReady } from '@hypha-platform/authentication';
import type { Coherence, Document, Person } from '@hypha-platform/core/client';
import { isOpenForVote } from './home-activity';
import {
  NETWORK_PULSE_PEOPLE_SPACE_LIMIT,
  NETWORK_PULSE_SPACE_LIMIT,
  NETWORK_PULSE_STORY_LIMIT,
  storyContext,
  uniquePeople,
  type NetworkPerson,
  type NetworkStory,
} from './network-pulse';

type CoherencePage = { data?: Coherence[] };
type MembersPage = { persons?: { data?: Person[] } };

type PulseSpace = {
  slug: string;
  title: string;
};

async function fetchJson<T>(
  url: string,
  headers: HeadersInit,
): Promise<T | null> {
  const response = await fetch(url, { headers });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

export function useNetworkPulse(spaces: PulseSpace[]) {
  const { getAccessToken, isAuthLoading, accessTokenReady } =
    useAccessTokenReady();
  const scopedSpaces = useMemo(
    () =>
      spaces
        .filter((space) => Boolean(space.slug))
        .slice(0, NETWORK_PULSE_SPACE_LIMIT),
    [spaces],
  );
  const spaceKey = scopedSpaces.map((space) => space.slug).join(',');
  const shouldFetch =
    scopedSpaces.length > 0 && !isAuthLoading && accessTokenReady;

  const { data, isLoading } = useSWR(
    shouldFetch ? ['network-pulse', spaceKey] : null,
    async () => {
      const token = await getAccessToken();
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      const pages = await Promise.all(
        scopedSpaces.map(async (space, index) => {
          const wantPeople = index < NETWORK_PULSE_PEOPLE_SPACE_LIMIT;
          const [documents, signalsPage, membersPage] = await Promise.all([
            fetchJson<Document[]>(
              `/api/v1/spaces/${encodeURIComponent(space.slug)}/documents/all`,
              headers,
            ),
            fetchJson<CoherencePage>(
              `/api/v1/spaces/${encodeURIComponent(
                space.slug,
              )}/coherences?page=1&pageSize=6&orderBy=mostrecent`,
              headers,
            ),
            wantPeople
              ? fetchJson<MembersPage>(
                  `/api/v1/spaces/${encodeURIComponent(
                    space.slug,
                  )}/members?page=1&pageSize=6`,
                  headers,
                )
              : Promise.resolve(null),
          ]);

          const stories: NetworkStory[] = [];
          for (const document of documents ?? []) {
            if (!isOpenForVote(document) || !document.slug) continue;
            stories.push({
              id: `vote:${space.slug}:${document.id}`,
              kind: 'vote',
              title: document.title,
              spaceSlug: space.slug,
              spaceTitle: space.title,
              targetSlug: document.slug,
              context: storyContext(document.description),
            });
          }
          for (const signal of signalsPage?.data ?? []) {
            if (signal.archived) continue;
            stories.push({
              id: `signal:${space.slug}:${signal.id}`,
              kind: 'signal',
              title: signal.title,
              spaceSlug: space.slug,
              spaceTitle: space.title,
              targetSlug: signal.slug,
              context: storyContext(signal.description),
            });
          }

          const people: NetworkPerson[] = (membersPage?.persons?.data ?? [])
            .filter((person) => Boolean(person.slug))
            .map((person) => ({
              slug: person.slug as string,
              name:
                [person.name, person.surname].filter(Boolean).join(' ') ||
                person.nickname ||
                (person.slug as string),
              avatarUrl: person.avatarUrl,
            }));

          return { stories, people };
        }),
      );

      return {
        stories: pages
          .flatMap((page) => page.stories)
          .slice(0, NETWORK_PULSE_STORY_LIMIT),
        people: uniquePeople(pages.flatMap((page) => page.people)),
      };
    },
    {
      revalidateOnFocus: true,
      refreshInterval: 60_000,
    },
  );

  return {
    stories: data?.stories ?? ([] as NetworkStory[]),
    people: data?.people ?? ([] as NetworkPerson[]),
    isLoading: shouldFetch && isLoading,
  };
}
