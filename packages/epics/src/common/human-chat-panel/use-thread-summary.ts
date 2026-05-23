'use client';

import useSWR from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';

export type ThreadSummaryPayload = {
  id: number;
  matrixRoomId: string;
  threadKind: 'space' | 'coherence';
  coherenceSlug: string | null;
  threadTitle: string | null;
  summary: string;
  bullets: string[];
  messageCount: number;
  participantCount: number;
  updatedAt: string;
  lastRefreshedAt: string | null;
};

type ThreadSummaryResponse = {
  summary: ThreadSummaryPayload | null;
};

export function useThreadSummary(
  spaceSlug: string | null | undefined,
  matrixRoomId: string | null | undefined,
) {
  const { getAccessToken } = useAuthentication();
  const slug = spaceSlug?.trim();
  const roomId = matrixRoomId?.trim();

  const { data, error, isLoading, mutate } = useSWR<ThreadSummaryResponse>(
    slug && roomId ? ['thread-summary', slug, roomId] : null,
    async () => {
      const token = await getAccessToken();
      const headers: HeadersInit = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const qs = new URLSearchParams({ matrixRoomId: roomId! });
      const res = await fetch(
        `/api/v1/spaces/${encodeURIComponent(
          slug!,
        )}/thread-summary?${qs.toString()}`,
        { headers },
      );
      if (!res.ok) {
        throw new Error(`Failed to load thread summary (${res.status})`);
      }
      return (await res.json()) as ThreadSummaryResponse;
    },
    {
      refreshInterval: 60_000,
      revalidateOnFocus: true,
    },
  );

  return {
    summary: data?.summary ?? null,
    isLoading,
    error,
    refresh: mutate,
  };
}

export async function recordThreadSummaryActivity(params: {
  spaceSlug: string;
  matrixRoomId: string;
  threadKind: 'space' | 'coherence';
  coherenceSlug?: string | null;
  threadTitle?: string | null;
  lastMessageEventId: string;
  lastMessageOriginServerTs: number;
  getAccessToken: () => Promise<string | null | undefined>;
}) {
  const token = await params.getAccessToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  await fetch(
    `/api/v1/spaces/${encodeURIComponent(
      params.spaceSlug,
    )}/thread-summary/activity`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        matrixRoomId: params.matrixRoomId,
        threadKind: params.threadKind,
        coherenceSlug: params.coherenceSlug ?? null,
        threadTitle: params.threadTitle ?? null,
        lastMessageEventId: params.lastMessageEventId,
        lastMessageOriginServerTs: params.lastMessageOriginServerTs,
      }),
    },
  );
}
