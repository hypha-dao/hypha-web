'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import {
  type Person,
  type QuestRecord,
  type SpaceQuestsOverview,
  type schemaCreateSpaceQuest,
  type schemaPatchSpaceQuest,
  type schemaPostQuestUpdate,
  type schemaQuestCreateDraftPayload,
} from '@hypha-platform/core/client';
import useSWR, { mutate } from 'swr';
import type { z } from 'zod';
import { personRosterDisplayLabel } from '../../common/human-chat-panel/build-space-roster-mention-candidates';

export const SPACE_QUESTS_SWR_KEY = 'space-quests' as const;
export const SPACE_QUEST_DRAFTS_SWR_KEY = 'space-quest-drafts' as const;

export type QuestDraftListItem = {
  id: number;
  name: string;
  updatedAt: string;
};

export type QuestDraftRecord = QuestDraftListItem & {
  payload: z.infer<typeof schemaQuestCreateDraftPayload>;
};

function questDraftListKey(spaceSlug: string) {
  return (key: unknown) =>
    Array.isArray(key) &&
    key[0] === SPACE_QUEST_DRAFTS_SWR_KEY &&
    key[1] === spaceSlug;
}

/** Refetch without replacing the cached list. Passing `undefined` as the next
 * value clears the cache, and SWR then drops the overlapping refetch. */
function revalidateQuestDrafts(spaceSlug: string) {
  return mutate(questDraftListKey(spaceSlug));
}

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

export type QuestSpaceMember = {
  person: Person;
  personId: number;
  name: string;
  avatarUrl: string | null;
  nickname: string | null;
};

function isCleanMemberDisplayName(name: string): boolean {
  if (!name || name.length > 60) return false;
  if (/https?:\/\/|www\.|\.blogspot\.|\.com\b/i.test(name)) return false;
  return true;
}

function toQuestSpaceMemberEntry(person: Person): QuestSpaceMember | null {
  if (!person || typeof person.id !== 'number' || person.id <= 0) {
    return null;
  }
  const name = personRosterDisplayLabel(person, '').trim();
  if (!isCleanMemberDisplayName(name)) return null;
  return {
    person,
    personId: person.id,
    name,
    avatarUrl: person.avatarUrl ?? null,
    nickname: person.nickname ?? null,
  };
}

/**
 * Space-scoped roster for quest pickers. Same source as the space Members
 * tab: on-chain members of this space from
 * `/api/v1/spaces/[spaceSlug]/members`. Not the network people directory.
 */
export function useQuestSpaceMembers(spaceSlug: string | undefined) {
  const { getAccessToken, user, isLoading: authLoading } = useAuthentication();
  const viewerKey = authLoading ? null : user?.id ?? 'anonymous';

  const { data } = useSWR(
    spaceSlug && viewerKey
      ? [SPACE_QUESTS_SWR_KEY, spaceSlug, 'members', viewerKey]
      : null,
    async ([, slug]) => {
      const headers = await authHeaders(getAccessToken);
      const people: Person[] = [];
      const pageSize = 100;
      const maxPages = 20;

      for (let page = 1; page <= maxPages; page += 1) {
        const response = await fetch(
          `/api/v1/spaces/${encodeURIComponent(
            slug,
          )}/members?page=${page}&pageSize=${pageSize}`,
          { headers },
        );
        if (!response.ok) {
          throw new Error(`Failed to load space members (${response.status})`);
        }
        const body = (await response.json()) as {
          persons?: {
            data?: Person[];
            pagination?: {
              hasNextPage?: boolean;
              totalPages?: number;
              pageCount?: number;
            };
          };
        };
        const batch = body.persons?.data ?? [];
        people.push(...batch);
        const pagination = body.persons?.pagination;
        if (batch.length < pageSize) break;
        if (pagination?.hasNextPage === false) break;
        const totalPages = pagination?.totalPages ?? pagination?.pageCount;
        if (totalPages != null && page >= totalPages) break;
      }

      const seenIds = new Set<number>();
      const roster: QuestSpaceMember[] = [];
      for (const person of people) {
        const entry = toQuestSpaceMemberEntry(person);
        if (!entry) continue;
        if (seenIds.has(entry.personId)) continue;
        seenIds.add(entry.personId);
        roster.push(entry);
      }
      return roster.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      );
    },
    { revalidateOnFocus: false },
  );

  return data ?? [];
}

export function findQuestSpaceMember(
  members: readonly QuestSpaceMember[],
  query: { personId?: number | null; name?: string | null },
): QuestSpaceMember | null {
  if (query.personId != null && query.personId > 0) {
    const byId = members.find((m) => m.personId === query.personId);
    if (byId) return byId;
  }
  const clean = query.name
    ?.replace(/\s*\(you\)\s*/i, '')
    .trim()
    .toLowerCase();
  if (!clean) return null;
  return (
    members.find(
      (m) =>
        m.name.toLowerCase() === clean ||
        (m.nickname && m.nickname.trim().toLowerCase() === clean),
    ) ?? null
  );
}

export function findQuestSpaceMemberId(
  members: readonly QuestSpaceMember[],
  name: string,
): number | null {
  return findQuestSpaceMember(members, { name })?.personId ?? null;
}

export function toQuestSpaceMemberPersons(
  members: readonly QuestSpaceMember[],
  extraNames: readonly (string | null | undefined)[] = [],
): Person[] {
  const list = members.map((m) => m.person);
  const knownNames = new Set(members.map((m) => m.name.trim().toLowerCase()));
  let syntheticId = -1;
  for (const raw of extraNames) {
    const clean = raw?.replace(/\s*\(you\)\s*/i, '').trim() ?? '';
    if (!clean || knownNames.has(clean.toLowerCase())) continue;
    knownNames.add(clean.toLowerCase());
    list.push({
      id: syntheticId,
      name: clean,
      surname: '',
    } as Person);
    syntheticId -= 1;
  }
  return list;
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

export function useMyQuestDrafts(spaceSlug: string | undefined) {
  const { getAccessToken, user, isLoading: authLoading } = useAuthentication();
  const viewerKey = authLoading ? null : user?.id ?? null;

  const {
    data,
    error,
    isLoading,
    mutate: refresh,
  } = useSWR(
    spaceSlug && viewerKey
      ? [SPACE_QUEST_DRAFTS_SWR_KEY, spaceSlug, viewerKey]
      : null,
    async ([, slug]) => {
      const headers = await authHeaders(getAccessToken);
      const response = await fetch(`/api/v1/spaces/${slug}/quests/drafts`, {
        headers,
      });
      if (!response.ok) {
        throw new Error('Failed to load quest drafts');
      }
      return (await response.json()) as { drafts: QuestDraftListItem[] };
    },
    { revalidateOnFocus: true },
  );

  return {
    drafts: data?.drafts ?? [],
    visible: Boolean(viewerKey),
    error,
    isLoading: authLoading || (Boolean(viewerKey) && isLoading),
    refresh,
  };
}

export async function getQuestDraftRequest({
  spaceSlug,
  draftId,
  getAccessToken,
}: {
  spaceSlug: string;
  draftId: number;
  getAccessToken?: () => Promise<string | null | undefined>;
}): Promise<QuestDraftRecord> {
  const headers = await authHeaders(getAccessToken);
  const response = await fetch(
    `/api/v1/spaces/${spaceSlug}/quests/drafts/${draftId}`,
    { headers },
  );
  if (!response.ok) {
    throw await requestError(response, 'Failed to load quest draft');
  }
  return (await response.json()) as QuestDraftRecord;
}

export async function saveQuestDraftRequest({
  spaceSlug,
  id,
  payload,
  getAccessToken,
  keepalive = false,
}: {
  spaceSlug: string;
  id?: number | null;
  payload: z.infer<typeof schemaQuestCreateDraftPayload>;
  getAccessToken?: () => Promise<string | null | undefined>;
  keepalive?: boolean;
}): Promise<QuestDraftRecord> {
  const headers = await authHeaders(getAccessToken);
  const response = await fetch(`/api/v1/spaces/${spaceSlug}/quests/drafts`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(id ? { id, payload } : { payload }),
    keepalive,
  });
  if (!response.ok) {
    throw await requestError(response, 'Failed to save quest draft');
  }
  const saved = (await response.json()) as QuestDraftRecord;
  await revalidateQuestDrafts(spaceSlug);
  return saved;
}

export async function deleteQuestDraftRequest({
  spaceSlug,
  draftId,
  getAccessToken,
}: {
  spaceSlug: string;
  draftId: number;
  getAccessToken?: () => Promise<string | null | undefined>;
}): Promise<void> {
  const headers = await authHeaders(getAccessToken);
  const response = await fetch(
    `/api/v1/spaces/${spaceSlug}/quests/drafts/${draftId}`,
    { method: 'DELETE', headers },
  );
  if (!response.ok) {
    throw await requestError(response, 'Failed to delete quest draft');
  }
  await mutate(
    questDraftListKey(spaceSlug),
    (current: { drafts: QuestDraftListItem[] } | undefined) => ({
      drafts: (current?.drafts ?? []).filter((draft) => draft.id !== draftId),
    }),
    { revalidate: true },
  );
}
