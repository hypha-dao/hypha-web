'use client';

import useSWR from 'swr';
import { useJwt } from '@hypha-platform/core/client';
import type { HighlightsProfileResponse } from '@hypha-platform/core/client';

async function fetchHighlightProfile(
  spaceSlug: string,
  authToken?: string | null,
): Promise<HighlightsProfileResponse> {
  const headers: HeadersInit = {};
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  const res = await fetch(`/api/v1/spaces/${spaceSlug}/highlights`, {
    headers,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? `Failed to load highlights (${res.status})`);
  }
  return res.json();
}

export function useHighlightProfile(spaceSlug: string) {
  const { jwt: authToken } = useJwt();

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    spaceSlug ? ['highlights-profile', spaceSlug, authToken ?? null] : null,
    ([, slug, token]) => fetchHighlightProfile(slug, token),
    { revalidateOnFocus: true },
  );

  return {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
    authToken,
  };
}
