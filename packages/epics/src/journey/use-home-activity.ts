'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { useAccessTokenReady } from '@hypha-platform/authentication';
import type { Coherence, Document } from '@hypha-platform/core/client';
import {
  HOME_ACTIVITY_SPACE_LIMIT,
  activityTimestamp,
  dueAtMs,
  excerptText,
  isActiveSignalRecommendation,
  isTaskRecommendation,
  selectAttentionItems,
  votesFromDocuments,
  type HomeAttentionItem,
  type HomeSignalItem,
  type HomeSpaceRef,
} from './home-activity';
import { fetchOutcomesBySpaceId, fetchProposalLiveness } from './vote-liveness';

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
  const spaceKey = scopedSpaces
    .map((space) => `${space.slug}:${space.web3SpaceId ?? ''}`)
    .join(',');
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
              )}/coherences?page=1&pageSize=16&orderBy=mostrecent`,
              headers,
            ),
          ]);

          return { space, documents: documents ?? [], signalsPage };
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

      const votes = pages.flatMap((page) =>
        votesFromDocuments(page.documents, page.space, {
          outcomes:
            page.space.web3SpaceId != null
              ? outcomesBySpaceId.get(page.space.web3SpaceId) ?? null
              : null,
          livenessByProposalId,
        }),
      );

      const mappedSignals = pages.flatMap((page) =>
        (page.signalsPage?.data ?? [])
          .filter(isActiveSignalRecommendation)
          .map((signal) => {
            const due = dueAtMs(signal.dueAt);
            const item: HomeSignalItem = {
              id: `${page.space.slug}:${signal.id}`,
              title: signal.title,
              spaceSlug: page.space.slug,
              spaceTitle: page.space.title,
              spaceLogoUrl: page.space.logoUrl ?? null,
              signalSlug: signal.slug,
              roomId: signal.roomId ?? null,
              description: excerptText(signal.description),
              type: signal.type ?? null,
              dueAt: due,
              progressStatus: signal.progressStatus ?? null,
              board: signal.board ?? null,
              assigneeIds: signal.assigneeIds ?? [],
              happenedAt: activityTimestamp(signal.updatedAt, signal.createdAt),
            };
            return item;
          }),
      );
      const tasks = mappedSignals.filter(isTaskRecommendation);
      const taskIds = new Set(tasks.map((item) => item.id));
      const signals = mappedSignals.filter((item) => !taskIds.has(item.id));

      const items = selectAttentionItems<HomeAttentionItem>([
        ...votes.map((item) => ({ ...item, kind: 'vote' as const })),
        ...tasks.map((item) => ({
          ...item,
          kind: 'task' as const,
          closesAt: item.dueAt,
        })),
        ...signals.map((item) => ({ ...item, kind: 'signal' as const })),
      ]);

      return { items };
    },
    {
      revalidateOnFocus: true,
      refreshInterval: 60_000,
    },
  );

  return {
    items: data?.items ?? ([] as HomeAttentionItem[]),
    isLoading: shouldFetch && isLoading,
  };
}
