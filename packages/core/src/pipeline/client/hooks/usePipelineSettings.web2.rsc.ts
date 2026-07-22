'use client';

import useSWR, { mutate } from 'swr';
import useSWRMutation from 'swr/mutation';
import { useAuthentication } from '@hypha-platform/authentication';
import type { PipelineUserSettingsRecord } from '../../types';

export const PIPELINE_SETTINGS_SWR_KEY = 'pipeline-settings' as const;

export function revalidatePipelineSettings(spaceSlug?: string) {
  const normalizedSlug = spaceSlug?.trim() || null;
  return mutate(
    (key: unknown) =>
      Array.isArray(key) &&
      key[0] === PIPELINE_SETTINGS_SWR_KEY &&
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

export function usePipelineSettings(spaceSlug?: string) {
  const { getAccessToken } = useAuthentication();
  const slug = spaceSlug?.trim() || null;

  const {
    data,
    isLoading,
    error,
    mutate: refresh,
  } = useSWR(
    slug ? ([PIPELINE_SETTINGS_SWR_KEY, slug] as const) : null,
    async ([, resolvedSlug]) => {
      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(resolvedSlug)}/pipeline/settings`,
        { headers: await authHeaders(getAccessToken) },
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch pipeline settings: ${response.status}`,
        );
      }
      const payload = (await response.json()) as {
        data: PipelineUserSettingsRecord | null;
      };
      return payload.data;
    },
    { revalidateOnFocus: true },
  );

  const saveMutation = useSWRMutation(
    slug ? [PIPELINE_SETTINGS_SWR_KEY, slug, 'save'] : null,
    async (_key, { arg }: { arg: { countryFocus: string[] } }) => {
      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(slug!)}/pipeline/settings`,
        {
          method: 'PUT',
          headers: await authHeaders(getAccessToken),
          body: JSON.stringify(arg),
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to save pipeline settings: ${response.status}`);
      }
      await revalidatePipelineSettings(slug!);
      const payload = (await response.json()) as {
        data: PipelineUserSettingsRecord;
      };
      return payload.data;
    },
  );

  return {
    settings: data ?? null,
    countryFocus: data?.countryFocus ?? [],
    isLoading,
    error,
    refresh,
    saveSettings: saveMutation.trigger,
    isSaving: saveMutation.isMutating,
  };
}
