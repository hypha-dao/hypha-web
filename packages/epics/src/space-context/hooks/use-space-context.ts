'use client';

import { useAuthentication } from '@hypha-platform/authentication';
import type {
  SpaceContextOverview,
  SpaceContextSectionDetail,
  SpaceContextSectionKey,
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
    { revalidateOnFocus: true },
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
  await revalidateSpaceContext(spaceSlug);
  return response.json();
}

export async function appendSpaceContextMessageRequest({
  spaceSlug,
  sectionKey,
  role,
  content,
  agentKey,
  getAccessToken,
}: {
  spaceSlug: string;
  sectionKey: SpaceContextSectionKey;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agentKey?: string;
  getAccessToken?: () => Promise<string | null | undefined>;
}) {
  const headers = await authHeaders(getAccessToken);
  const response = await fetch(
    `/api/v1/spaces/${spaceSlug}/context/${sectionKey}/messages`,
    {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, content, agentKey }),
    },
  );
  if (!response.ok) {
    throw new Error('Failed to save chat message');
  }
  return response.json();
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
