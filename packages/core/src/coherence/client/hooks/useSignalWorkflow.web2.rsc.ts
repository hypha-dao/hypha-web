'use client';

import useSWR from 'swr';
import type { SignalWorkflowConfig } from '../../signal-workflow';
import { useJwt } from '../../../people/client/hooks/useJwt';

export function useSignalWorkflow(spaceSlug?: string) {
  const { jwt } = useJwt();
  const key =
    spaceSlug && jwt ? ([spaceSlug, jwt, 'signal-workflow'] as const) : null;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    async ([slug, token]) => {
      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(slug)}/signal-workflow`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch signal workflow: ${response.status}`);
      }
      return (await response.json()) as SignalWorkflowConfig;
    },
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
    },
  );

  return {
    workflow: data,
    isLoading,
    error,
    refresh: mutate,
  };
}
