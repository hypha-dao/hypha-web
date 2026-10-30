'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import type {
  SpaceContextOverview,
  SpaceContextSectionDetail,
  SpaceContextSectionKey,
  SpaceContextSectionRecord,
} from '@hypha-platform/core/client';
import useSWR, { mutate } from 'swr';

export const SPACE_CONTEXT_SWR_KEY = 'space-context' as const;

export function revalidateSpaceContext(spaceSlug: string) {
  return mutate(
    (key: unknown) =>
      Array.isArray(key) &&
      key[0] === SPACE_CONTEXT_SWR_KEY &&
      key[1] === spaceSlug,
    undefined,
    { revalidate: true },
  );
}

function isOverview(value: unknown): value is SpaceContextOverview {
  return (
    !!value &&
    typeof value === 'object' &&
    'sections' in value &&
    Array.isArray((value as SpaceContextOverview).sections)
  );
}

function isDetail(value: unknown): value is SpaceContextSectionDetail {
  return (
    !!value &&
    typeof value === 'object' &&
    'section' in value &&
    'messages' in value
  );
}

function mergeSectionRecord(
  current: SpaceContextSectionRecord,
  updated: SpaceContextSectionRecord,
): SpaceContextSectionRecord {
  return {
    ...current,
    ...updated,
    contributorCount: Math.max(
      current.contributorCount,
      updated.contributorCount ?? 0,
    ),
    lastEditorName: updated.lastEditorName ?? current.lastEditorName,
    proposalTitle: updated.proposalTitle ?? current.proposalTitle,
    proposalSlug: updated.proposalSlug ?? current.proposalSlug,
    proposalWeb3Id: updated.proposalWeb3Id ?? current.proposalWeb3Id,
    proposalStatus: updated.proposalStatus ?? current.proposalStatus,
    ...(updated.ratifiedDocumentId === current.ratifiedDocumentId
      ? {
          ratifiedTitle: updated.ratifiedTitle ?? current.ratifiedTitle,
          ratifiedSlug: updated.ratifiedSlug ?? current.ratifiedSlug,
          ratifiedWeb3Id: updated.ratifiedWeb3Id ?? current.ratifiedWeb3Id,
        }
      : {}),
  };
}

/** Write a saved section into SWR so cards update without waiting on dedupe. */
export function applySpaceContextSectionToCache(
  spaceSlug: string,
  updated: SpaceContextSectionRecord,
) {
  return mutate(
    (key: unknown) =>
      Array.isArray(key) &&
      key[0] === SPACE_CONTEXT_SWR_KEY &&
      key[1] === spaceSlug,
    (current: unknown) => {
      if (isOverview(current)) {
        const sections = current.sections.map((section) =>
          section.sectionKey === updated.sectionKey
            ? mergeSectionRecord(section, updated)
            : section,
        );
        return {
          ...current,
          sections,
          ratifiedCount: sections.filter(
            (section) => section.status === 'ratified',
          ).length,
        };
      }
      if (
        isDetail(current) &&
        current.section.sectionKey === updated.sectionKey
      ) {
        return {
          ...current,
          section: mergeSectionRecord(current.section, updated),
        };
      }
      return current;
    },
    { revalidate: false },
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

export function useSpaceContext(spaceSlug: string | undefined) {
  const { getAccessToken } = useAuthentication();

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    spaceSlug ? [SPACE_CONTEXT_SWR_KEY, spaceSlug, 'overview'] : null,
    async ([, slug]) => {
      const headers = await authHeaders(getAccessToken);
      const response = await fetch(`/api/v1/spaces/${slug}/context`, {
        headers,
      });
      if (!response.ok) {
        throw new Error('Failed to load space context');
      }
      return (await response.json()) as SpaceContextOverview;
    },
    {
      revalidateOnFocus: true,
      refreshInterval: (latest) =>
        latest?.sections.some((section) => section.status === 'proposed')
          ? 15_000
          : 0,
    },
  );

  return {
    overview: data,
    error,
    isLoading,
    isValidating,
    refresh: mutate,
  };
}

export function useSpaceContextSection(
  spaceSlug: string | undefined,
  sectionKey: SpaceContextSectionKey | null,
) {
  const { getAccessToken } = useAuthentication();

  const { data, error, isLoading, mutate } = useSWR(
    spaceSlug && sectionKey
      ? [SPACE_CONTEXT_SWR_KEY, spaceSlug, sectionKey]
      : null,
    async ([, slug, key]) => {
      const headers = await authHeaders(getAccessToken);
      const response = await fetch(`/api/v1/spaces/${slug}/context/${key}`, {
        headers,
      });
      if (!response.ok) {
        throw new Error('Failed to load context section');
      }
      return (await response.json()) as SpaceContextSectionDetail;
    },
    // Other members and the section agent save drafts while the panel is open.
    { refreshInterval: 20_000, revalidateOnFocus: true },
  );

  return {
    detail: data,
    error,
    isLoading,
    refresh: mutate,
  };
}

export async function patchSpaceContextSectionRequest({
  spaceSlug,
  sectionKey,
  markdown,
  getAccessToken,
}: {
  spaceSlug: string;
  sectionKey: SpaceContextSectionKey;
  markdown: string;
  getAccessToken?: () => Promise<string | null | undefined>;
}) {
  const headers = await authHeaders(getAccessToken);
  const response = await fetch(
    `/api/v1/spaces/${spaceSlug}/context/${sectionKey}`,
    {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown }),
    },
  );
  if (!response.ok) {
    throw new Error('Failed to save section draft');
  }
  const updated = (await response.json()) as SpaceContextSectionRecord;
  await applySpaceContextSectionToCache(spaceSlug, updated);
  return updated;
}

/** Store the section's discussion room. Returns the room the server kept. */
export async function storeSpaceContextChatRoomRequest({
  spaceSlug,
  sectionKey,
  chatRoomId,
  getAccessToken,
}: {
  spaceSlug: string;
  sectionKey: SpaceContextSectionKey;
  chatRoomId: string;
  getAccessToken?: () => Promise<string | null | undefined>;
}): Promise<string | null> {
  const headers = await authHeaders(getAccessToken);
  const response = await fetch(
    `/api/v1/spaces/${spaceSlug}/context/${sectionKey}`,
    {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatRoomId }),
    },
  );
  if (!response.ok) {
    throw new Error('Failed to store the section chat room');
  }
  const updated = (await response.json()) as SpaceContextSectionRecord;
  await applySpaceContextSectionToCache(spaceSlug, updated);
  return updated.chatRoomId;
}

export async function importSpaceContextFromMemoryRequest({
  spaceSlug,
  getAccessToken,
}: {
  spaceSlug: string;
  getAccessToken?: () => Promise<string | null | undefined>;
}) {
  const headers = await authHeaders(getAccessToken);
  const response = await fetch(
    `/api/v1/spaces/${spaceSlug}/context/import-memory`,
    { method: 'POST', headers },
  );
  if (!response.ok) {
    throw new Error('Failed to import from Space Memory');
  }
  await revalidateSpaceContext(spaceSlug);
  return response.json();
}

export async function proposeSpaceContextSectionsRequest({
  spaceSlug,
  sectionKeys,
  documentId,
  getAccessToken,
}: {
  spaceSlug: string;
  sectionKeys: SpaceContextSectionKey[];
  documentId: number;
  getAccessToken?: () => Promise<string | null | undefined>;
}) {
  const headers = await authHeaders(getAccessToken);
  const response = await fetch(`/api/v1/spaces/${spaceSlug}/context/propose`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sectionKeys, documentId }),
  });
  if (!response.ok) {
    throw new Error('Failed to link sections to the proposal');
  }
  await revalidateSpaceContext(spaceSlug);
  return response.json();
}
