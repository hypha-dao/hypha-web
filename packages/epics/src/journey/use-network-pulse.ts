'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { useAccessTokenReady } from '@hypha-platform/authentication';
import {
  type Coherence,
  type Document,
  type Person,
  useMe,
} from '@hypha-platform/core/client';
import {
  isActiveSignalRecommendation,
  isActiveVoteRecommendation,
} from './home-activity';
import {
  NETWORK_PULSE_PEOPLE_SPACE_LIMIT,
  NETWORK_PULSE_SPACE_LIMIT,
  NETWORK_PULSE_STORY_LIMIT,
  storyContext,
  uniquePeople,
  type NetworkPerson,
  type NetworkStory,
} from './network-pulse';
import { fetchOutcomesBySpaceId, fetchProposalLiveness } from './vote-liveness';

type CoherencePage = { data?: Coherence[] };
type MembersPage = { persons?: { data?: Person[] } };

type PulseSpace = {
  slug: string;
  title: string;
  logoUrl?: string | null;
  web3SpaceId?: number | null;
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
  const { person } = useMe();
  const { getAccessToken, isAuthLoading, accessTokenReady } =
    useAccessTokenReady();
  const scopedSpaces = useMemo(
    () =>
      spaces
        .filter((space) => Boolean(space.slug))
        .slice(0, NETWORK_PULSE_SPACE_LIMIT),
    [spaces],
  );
  const spaceKey = scopedSpaces
    .map((space) => `${space.slug}:${space.web3SpaceId ?? ''}`)
    .join(',');
  const shouldFetch =
    scopedSpaces.length > 0 && !isAuthLoading && accessTokenReady;

  const { data, isLoading } = useSWR(
    shouldFetch ? ['network-pulse', spaceKey, person?.slug ?? ''] : null,
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

          return {
            space,
            documents: documents ?? [],
            signalsPage,
            membersPage,
          };
        }),
      );

      const outcomesBySpaceId = await fetchOutcomesBySpaceId(
        scopedSpaces
          .map((space) => space.web3SpaceId)
          .filter((id): id is number => id != null),
      );
      const candidateProposalIds = pages.flatMap((page) =>
        page.documents
          .map((document) => document.web3ProposalId)
          .filter((id): id is number => id != null),
      );
      const livenessByProposalId = await fetchProposalLiveness(
        candidateProposalIds,
      );

      const stories: NetworkStory[] = [];
      for (const page of pages) {
        const outcomes =
          page.space.web3SpaceId != null
            ? outcomesBySpaceId.get(page.space.web3SpaceId) ?? null
            : null;
        for (const document of page.documents) {
          const proposalId = document.web3ProposalId;
          if (
            !isActiveVoteRecommendation(document, {
              outcomes,
              liveness:
                proposalId != null
                  ? livenessByProposalId.get(proposalId) ?? null
                  : null,
            }) ||
            !document.slug
          ) {
            continue;
          }
          stories.push({
            id: `vote:${page.space.slug}:${document.id}`,
            kind: 'vote',
            title: document.title,
            spaceSlug: page.space.slug,
            spaceTitle: page.space.title,
            spaceLogoUrl: page.space.logoUrl ?? null,
            targetSlug: document.slug,
            context: storyContext(document.description),
          });
        }
        for (const signal of page.signalsPage?.data ?? []) {
          if (!isActiveSignalRecommendation(signal)) continue;
          stories.push({
            id: `signal:${page.space.slug}:${signal.id}`,
            kind: 'signal',
            title: signal.title,
            spaceSlug: page.space.slug,
            spaceTitle: page.space.title,
            spaceLogoUrl: page.space.logoUrl ?? null,
            targetSlug: signal.slug,
            context: storyContext(signal.description),
          });
        }
      }

      const people: NetworkPerson[] = pages.flatMap((page) =>
        (page.membersPage?.persons?.data ?? [])
          .filter(
            (member) => Boolean(member.slug) && member.networkVisible !== false,
          )
          .map((member) => ({
            id: member.id,
            slug: member.slug as string,
            name:
              [member.name, member.surname].filter(Boolean).join(' ') ||
              member.nickname ||
              (member.slug as string),
            avatarUrl: member.avatarUrl,
            networkVisible: member.networkVisible !== false,
          })),
      );

      return {
        stories: stories.slice(0, NETWORK_PULSE_STORY_LIMIT),
        people: uniquePeople(people, person?.slug),
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
