'use client';

import type { IntelligenceArtifactPatch } from '@hypha-platform/core/intelligence';
import { useAuthentication } from '@hypha-platform/authentication';
import React from 'react';
import useSWR, { mutate } from 'swr';
import { revalidateSpaceIntelligence } from './use-space-intelligence';

export const SIGNAL_INTELLIGENCE_PATCH_SWR_KEY =
  'signal-intelligence-patch' as const;

type PatchResponse = {
  space_slug: string;
  configured: boolean;
  patch: IntelligenceArtifactPatch | null;
};

async function fetchPatch(
  spaceSlug: string,
  signalSlug: string,
  token: string | null,
): Promise<PatchResponse> {
  const res = await fetch(
    `/api/v1/spaces/${encodeURIComponent(
      spaceSlug,
    )}/signals/${encodeURIComponent(signalSlug)}/intelligence-patch`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: 'no-store',
    },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error || `Failed to load patch (${res.status})`);
  }
  return res.json() as Promise<PatchResponse>;
}

export function revalidateSignalIntelligencePatch(
  spaceSlug: string,
  signalSlug: string,
) {
  return mutate(
    (key: unknown) =>
      Array.isArray(key) &&
      key[0] === SIGNAL_INTELLIGENCE_PATCH_SWR_KEY &&
      key[1] === spaceSlug &&
      key[2] === signalSlug,
    undefined,
    { revalidate: true },
  );
}

export function useSignalIntelligencePatch(
  spaceSlug: string,
  signalSlug: string | null | undefined,
) {
  const { getAccessToken } = useAuthentication();
  const [token, setToken] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [isActing, setIsActing] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const t = await getAccessToken();
        if (!cancelled) setToken(t ?? null);
      } catch {
        if (!cancelled) setToken(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  const key =
    spaceSlug && signalSlug
      ? ([
          SIGNAL_INTELLIGENCE_PATCH_SWR_KEY,
          spaceSlug,
          signalSlug,
          token,
        ] as const)
      : null;

  const {
    data,
    error,
    isLoading,
    mutate: mutatePatch,
  } = useSWR(key, ([, slug, signal, t]) => fetchPatch(slug, signal, t), {
    revalidateOnFocus: false,
  });

  const postAction = React.useCallback(
    async (
      action: 'approve' | 'reject' | 'propose',
      body?: Record<string, unknown>,
    ) => {
      if (!spaceSlug || !signalSlug) return;
      setIsActing(true);
      setActionError(null);
      try {
        const accessToken = (await getAccessToken()) ?? token;
        const res = await fetch(
          `/api/v1/spaces/${encodeURIComponent(
            spaceSlug,
          )}/signals/${encodeURIComponent(signalSlug)}/intelligence-patch`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(accessToken
                ? { Authorization: `Bearer ${accessToken}` }
                : {}),
            },
            body: JSON.stringify({ action, ...body }),
          },
        );
        const json = (await res.json().catch(() => null)) as {
          error?: string;
          currentSha?: string;
        } | null;
        if (!res.ok) {
          throw new Error(
            json?.error ||
              (res.status === 409
                ? 'Content changed; reload and retry.'
                : `Request failed (${res.status})`),
          );
        }
        await mutatePatch();
        await revalidateSignalIntelligencePatch(spaceSlug, signalSlug);
        if (action === 'approve') {
          await revalidateSpaceIntelligence(spaceSlug);
        }
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : 'Failed to update patch',
        );
        throw err;
      } finally {
        setIsActing(false);
      }
    },
    [getAccessToken, mutatePatch, signalSlug, spaceSlug, token],
  );

  return {
    patch: data?.patch ?? null,
    configured: data?.configured ?? false,
    isLoading,
    error: error instanceof Error ? error.message : null,
    actionError,
    isActing,
    approve: (markdown?: string) =>
      postAction('approve', markdown ? { markdown } : undefined),
    reject: () => postAction('reject'),
    refresh: () => mutatePatch(),
  };
}
