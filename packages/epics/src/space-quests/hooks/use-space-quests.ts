'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import type {
  QuestRecord,
  SpaceQuestsOverview,
  schemaCreateSpaceQuest,
  schemaPatchSpaceQuest,
  schemaPostQuestUpdate,
} from '@hypha-platform/core/client';
import useSWR, { mutate } from 'swr';
import type { z } from 'zod';

export const SPACE_QUESTS_SWR_KEY = 'space-quests' as const;

export function revalidateSpaceQuests(spaceSlug: string) {
  return mutate(
    (key: unknown) =>
      Array.isArray(key) &&
      key[0] === SPACE_QUESTS_SWR_KEY &&
      key[1] === spaceSlug,
    undefined,
    { revalidate: true },
  );
}

async function authHeaders(
  getAccessToken?: () => Promise<string | null | undefined>,
): Promise<HeadersInit> {
  try {
    const token = await getAccessToken?.();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export function useSpaceQuests(spaceSlug: string | undefined) {
  const { getAccessToken, user, isLoading: authLoading } = useAuthentication();
  const viewerKey = authLoading ? null : user?.id ?? 'anonymous';

  const {
    data,
    error,
    isLoading,
    isValidating,
    mutate: refresh,
  } = useSWR(
    spaceSlug && viewerKey
      ? [SPACE_QUESTS_SWR_KEY, spaceSlug, 'overview', viewerKey]
      : null,
    async ([, slug]) => {
      const headers = await authHeaders(getAccessToken);
      const response = await fetch(`/api/v1/spaces/${slug}/quests`, {
        headers,
      });
      if (!response.ok) {
        throw new Error('Failed to load space quests');
      }
      return (await response.json()) as SpaceQuestsOverview;
    },
    {
      revalidateOnFocus: true,
      refreshInterval: (latest) =>
        latest?.quests.some((q) => q.status === 'proposed') ? 5_000 : 0,
    },
  );

  return {
    overview: data,
    error,
    isLoading,
    isValidating,
    refresh,
  };
}

export function useSpaceQuestDetail(
  spaceSlug: string | undefined,
  questSlug: string | null | undefined,
) {
  const { getAccessToken, user, isLoading: authLoading } = useAuthentication();
  const viewerKey = authLoading ? null : user?.id ?? 'anonymous';

  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useSWR(
    spaceSlug && questSlug && viewerKey
      ? [SPACE_QUESTS_SWR_KEY, spaceSlug, 'detail', questSlug, viewerKey]
      : null,
    async ([, slug, , qSlug]) => {
      const headers = await authHeaders(getAccessToken);
      const response = await fetch(
        `/api/v1/spaces/${slug}/quests/${encodeURIComponent(qSlug)}`,
        { headers },
      );
      if (!response.ok) {
        throw new Error('Failed to load quest');
      }
      return (await response.json()) as QuestRecord;
    },
    { refreshInterval: 15_000, revalidateOnFocus: true },
  );

  return {
    quest: data,
    error,
    isLoading,
    refresh,
  };
}

export type QuestSpaceMember = { personId: number; name: string };

/** Space roster for quest pickers, read through the access-checked members API. */
export function useQuestSpaceMembers(spaceSlug: string | undefined) {
  const { getAccessToken, user, isLoading: authLoading } = useAuthentication();
  const viewerKey = authLoading ? null : user?.id ?? 'anonymous';

  const { data } = useSWR(
    spaceSlug && viewerKey
      ? [SPACE_QUESTS_SWR_KEY, spaceSlug, 'members', viewerKey]
      : null,
    async ([, slug]) => {
      const headers = await authHeaders(getAccessToken);
      const response = await fetch(
        `/api/v1/spaces/${slug}/members?page=1&pageSize=200`,
        { headers },
      );
      if (!response.ok) return [];
      const body = (await response.json()) as {
        persons?: {
          data?: Array<{ id: number; name?: string; surname?: string }>;
        };
      };
      const seen = new Set<string>();
      return (body.persons?.data ?? []).flatMap((person) => {
        const name = [person.name, person.surname]
          .filter(Boolean)
          .join(' ')
          .trim();
        if (!name || seen.has(name)) return [];
        seen.add(name);
        return [{ personId: person.id, name }];
      });
    },
    { revalidateOnFocus: false },
  );

  return data ?? [];
}

export function findQuestSpaceMemberId(
  members: readonly QuestSpaceMember[],
  name: string,
): number | null {
  const clean = name.trim().toLowerCase();
  return members.find((m) => m.name.toLowerCase() === clean)?.personId ?? null;
}

export class SpaceQuestRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'SpaceQuestRequestError';
  }
}

async function requestError(response: Response, fallback: string) {
  let code: string | null = null;
  let message = fallback;
  try {
    const body = (await response.json()) as { error?: string; code?: string };
    code = body.code ?? null;
    message = body.error || fallback;
  } catch {
    // Non-JSON error body
  }
  return new SpaceQuestRequestError(message, response.status, code);
}

export async function createSpaceQuestRequest({
  spaceSlug,
  body,
  getAccessToken,
}: {
  spaceSlug: string;
  body: z.infer<typeof schemaCreateSpaceQuest>;
  getAccessToken?: () => Promise<string | null | undefined>;
}): Promise<QuestRecord> {
  const headers = await authHeaders(getAccessToken);
  const response = await fetch(`/api/v1/spaces/${spaceSlug}/quests`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await requestError(response, 'Failed to create quest');
  }
  const created = (await response.json()) as QuestRecord;
  await revalidateSpaceQuests(spaceSlug);
  return created;
}

export async function patchSpaceQuestRequest({
  spaceSlug,
  questSlug,
  patch,
  getAccessToken,
}: {
  spaceSlug: string;
  questSlug: string;
  patch: z.infer<typeof schemaPatchSpaceQuest>;
  getAccessToken?: () => Promise<string | null | undefined>;
}): Promise<QuestRecord> {
  const headers = await authHeaders(getAccessToken);
  const response = await fetch(
    `/api/v1/spaces/${spaceSlug}/quests/${encodeURIComponent(questSlug)}`,
    {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    },
  );
  if (!response.ok) {
    throw await requestError(response, 'Failed to update quest');
  }
  const updated = (await response.json()) as QuestRecord;
  await revalidateSpaceQuests(spaceSlug);
  return updated;
}

export async function postSpaceQuestUpdateRequest({
  spaceSlug,
  questSlug,
  body,
  getAccessToken,
}: {
  spaceSlug: string;
  questSlug: string;
  body: z.infer<typeof schemaPostQuestUpdate>;
  getAccessToken?: () => Promise<string | null | undefined>;
}): Promise<QuestRecord> {
  const headers = await authHeaders(getAccessToken);
  const response = await fetch(
    `/api/v1/spaces/${spaceSlug}/quests/${encodeURIComponent(
      questSlug,
    )}/updates`,
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    throw await requestError(response, 'Failed to post quest update');
  }
  const updated = (await response.json()) as QuestRecord;
  await revalidateSpaceQuests(spaceSlug);
  return updated;
}

export async function deleteSpaceQuestRequest({
  spaceSlug,
  questSlug,
  getAccessToken,
}: {
  spaceSlug: string;
  questSlug: string;
  getAccessToken?: () => Promise<string | null | undefined>;
}): Promise<void> {
  const headers = await authHeaders(getAccessToken);
  const response = await fetch(
    `/api/v1/spaces/${spaceSlug}/quests/${encodeURIComponent(questSlug)}`,
    {
      method: 'DELETE',
      headers,
    },
  );
  if (!response.ok) {
    throw await requestError(response, 'Failed to delete quest');
  }
  await revalidateSpaceQuests(spaceSlug);
}
