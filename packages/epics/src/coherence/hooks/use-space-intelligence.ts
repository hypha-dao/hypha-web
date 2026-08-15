'use client';

import {
  buildIntelligenceSignalGraph,
  type IntelligenceGraph,
  type IntelligenceListItem,
  type IntelligenceFrontmatter,
} from '@hypha-platform/core/intelligence';
import { useAuthentication } from '@hypha-platform/authentication';
import queryString from 'query-string';
import React from 'react';
import useSWR, { mutate } from 'swr';

export const SPACE_INTELLIGENCE_SWR_KEY = 'space-intelligence' as const;

type IntelligenceListResponse = {
  space_slug: string;
  configured: boolean;
  artifacts: IntelligenceListItem[];
  graph: IntelligenceGraph;
  enabled_packs?: string[];
};

export type IntelligenceArtifactPayload = {
  path: string;
  sha: string;
  frontmatter: IntelligenceFrontmatter;
  body: string;
};

type IntelligenceArtifactResponse = {
  space_slug: string;
  configured: boolean;
  artifact: IntelligenceArtifactPayload;
};

export function revalidateSpaceIntelligence(spaceSlug: string) {
  return mutate(
    (key: unknown) =>
      Array.isArray(key) &&
      key[0] === SPACE_INTELLIGENCE_SWR_KEY &&
      key[1] === spaceSlug,
    undefined,
    { revalidate: true },
  );
}

export function useSpaceIntelligence(spaceSlug: string | undefined) {
  const { getAccessToken } = useAuthentication();
  const [typeFilter, setTypeFilter] = React.useState<string>('all');
  const [searchTerm, setSearchTerm] = React.useState('');

  const key = spaceSlug
    ? ([
        SPACE_INTELLIGENCE_SWR_KEY,
        spaceSlug,
        typeFilter,
        searchTerm.trim(),
      ] as const)
    : null;

  const {
    data,
    error,
    isLoading,
    isValidating,
    mutate: revalidate,
  } = useSWR(key, async ([, slug, type, search]) => {
    const qs = queryString.stringify({
      ...(type && type !== 'all' ? { type } : {}),
      ...(search ? { search } : {}),
    });
    const token = await getAccessToken();
    const headers: HeadersInit = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(
      `/api/v1/spaces/${slug}/intelligence${qs ? `?${qs}` : ''}`,
      { headers },
    );
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(payload?.error || `HTTP ${res.status}`);
    }
    return (await res.json()) as IntelligenceListResponse;
  });

  const createArtifact = React.useCallback(
    async (input: {
      markdown?: string;
      frontmatter?: Record<string, unknown>;
      body?: string;
      expectedSha?: string;
      source_app?: string;
    }) => {
      if (!spaceSlug) throw new Error('Missing space');
      const token = await getAccessToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/v1/spaces/${spaceSlug}/intelligence`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (payload as { error?: string }).error || `HTTP ${res.status}`,
        );
      }
      await revalidate();
      return payload;
    },
    [getAccessToken, revalidate, spaceSlug],
  );

  const deleteArtifact = React.useCallback(
    async (input: { artifactId: string; expectedSha: string }) => {
      if (!spaceSlug) throw new Error('Missing space');
      const token = await getAccessToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(
        `/api/v1/spaces/${spaceSlug}/intelligence/${encodeURIComponent(
          input.artifactId,
        )}`,
        {
          method: 'DELETE',
          headers,
          body: JSON.stringify({ expectedSha: input.expectedSha }),
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (payload as { error?: string }).error || `HTTP ${res.status}`,
        );
      }
      await revalidate();
      return payload;
    },
    [getAccessToken, revalidate, spaceSlug],
  );

  const enablePack = React.useCallback(
    async (packId: string) => {
      if (!spaceSlug) throw new Error('Missing space');
      const token = await getAccessToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(
        `/api/v1/spaces/${spaceSlug}/intelligence/packs`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ pack_id: packId }),
        },
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (payload as { error?: string }).error || `HTTP ${res.status}`,
        );
      }
      await revalidate();
      return payload as {
        pack_id: string;
        seeded: string[];
        skipped: string[];
      };
    },
    [getAccessToken, revalidate, spaceSlug],
  );

  const artifacts = data?.artifacts ?? [];
  const graph = data?.graph ?? buildIntelligenceSignalGraph({ artifacts });

  return {
    artifacts,
    graph,
    configured: data?.configured ?? false,
    isLoading,
    isValidating,
    error,
    typeFilter,
    setTypeFilter,
    searchTerm,
    setSearchTerm,
    refresh: () => revalidate(),
    createArtifact,
    deleteArtifact,
    enablePack,
    enabledPacks: data?.enabled_packs ?? [],
  };
}

export function useIntelligenceArtifact(
  spaceSlug: string | undefined,
  artifactId: string | undefined,
) {
  const { getAccessToken } = useAuthentication();
  const key =
    spaceSlug && artifactId
      ? ([
          SPACE_INTELLIGENCE_SWR_KEY,
          spaceSlug,
          'artifact',
          artifactId,
        ] as const)
      : null;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    async ([, slug, , id]) => {
      const token = await getAccessToken();
      const headers: HeadersInit = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(
        `/api/v1/spaces/${slug}/intelligence/${encodeURIComponent(id)}`,
        { headers },
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }
      return (await res.json()) as IntelligenceArtifactResponse;
    },
  );

  return {
    artifact: data?.artifact ?? null,
    configured: data?.configured ?? false,
    isLoading,
    error:
      error instanceof Error ? error : error ? new Error(String(error)) : null,
    refresh: () => mutate(),
  };
}
