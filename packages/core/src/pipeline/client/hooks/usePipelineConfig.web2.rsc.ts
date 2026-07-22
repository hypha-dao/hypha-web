'use client';

import useSWR, { mutate } from 'swr';
import useSWRMutation from 'swr/mutation';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  DEFAULT_PIPELINE_CONFIG,
  type PipelineConfig,
  type PipelineConfigPatch,
} from '../../pipeline-config';

export const PIPELINE_CONFIG_SWR_KEY = 'pipeline-config' as const;

export function revalidatePipelineConfig(spaceSlug?: string) {
  const normalizedSlug = spaceSlug?.trim() || null;
  return mutate(
    (key: unknown) =>
      Array.isArray(key) &&
      key[0] === PIPELINE_CONFIG_SWR_KEY &&
      (normalizedSlug == null || key[1] === normalizedSlug),
    undefined,
    { revalidate: true },
  );
}

async function authHeaders(
  getAccessToken: () => Promise<string | null>,
): Promise<HeadersInit> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const token = await getAccessToken();
  if (token) {
    (headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function usePipelineConfig(spaceSlug?: string) {
  const { getAccessToken } = useAuthentication();
  const slug = spaceSlug?.trim() || null;

  const {
    data,
    isLoading,
    error,
    mutate: refresh,
  } = useSWR(
    slug ? ([PIPELINE_CONFIG_SWR_KEY, slug] as const) : null,
    async ([, resolvedSlug]) => {
      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(resolvedSlug)}/pipeline/config`,
        { headers: await authHeaders(getAccessToken) },
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch pipeline config: ${response.status}`);
      }
      const payload = (await response.json()) as { data: PipelineConfig };
      return payload.data;
    },
    { revalidateOnFocus: true },
  );

  const saveMutation = useSWRMutation(
    slug ? [PIPELINE_CONFIG_SWR_KEY, slug, 'save'] : null,
    async (_key, { arg }: { arg: PipelineConfigPatch }) => {
      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(slug!)}/pipeline/config`,
        {
          method: 'PUT',
          headers: await authHeaders(getAccessToken),
          body: JSON.stringify(arg),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          body.error || `Failed to save pipeline config: ${response.status}`,
        );
      }
      await revalidatePipelineConfig(slug!);
      const payload = (await response.json()) as { data: PipelineConfig };
      return payload.data;
    },
  );

  const config = data ?? DEFAULT_PIPELINE_CONFIG;

  return {
    config,
    regions: config.regions,
    defaultRegion: config.defaultRegion,
    probabilities: config.probabilities,
    isLoading,
    error,
    refresh,
    saveConfig: saveMutation.trigger,
    isSaving: saveMutation.isMutating,
  };
}
