'use client';

import useSWRMutation from 'swr/mutation';
import type { SignalWorkflowConfig } from '../../signal-workflow';
import { useJwt } from '../../../people/client/hooks/useJwt';

function readWorkflowUpdateError(payload: {
  error?: string | { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };
} | null): string | undefined {
  if (!payload?.error) return undefined;
  if (typeof payload.error === 'string') return payload.error;
  const fieldMessage = Object.values(payload.error.fieldErrors ?? {})
    .flatMap((messages) => messages ?? [])
    .find(Boolean);
  return fieldMessage ?? payload.error.formErrors?.[0];
}

export function useUpdateSignalWorkflow(spaceSlug?: string) {
  const { jwt } = useJwt();

  const { trigger, isMutating, error } = useSWRMutation(
    jwt && spaceSlug
      ? ([spaceSlug, jwt, 'updateSignalWorkflow'] as const)
      : null,
    async ([slug, token], { arg }: { arg: SignalWorkflowConfig }) => {
      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(slug)}/signal-workflow`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(arg),
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string | { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };
        } | null;
        throw new Error(
          readWorkflowUpdateError(payload) ??
            `Failed to update signal workflow: ${response.status}`,
        );
      }
      return (await response.json()) as SignalWorkflowConfig;
    },
  );

  return {
    updateWorkflow: trigger,
    isUpdating: isMutating,
    error,
  };
}
