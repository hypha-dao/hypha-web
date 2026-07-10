'use client';

import useSWRMutation from 'swr/mutation';
import { useAuthentication } from '@hypha-platform/authentication';
import type { Coherence, PatchCoherenceTaskBySlugInput } from '../../types';
import { hydrateCoherenceFromApi } from '../../signal-workflow';

export function usePatchCoherenceTask(spaceSlug?: string) {
  const { getAccessToken, isAuthenticated } = useAuthentication();
  const slug = spaceSlug?.trim() || null;

  const { trigger, isMutating, error } = useSWRMutation(
    slug && isAuthenticated ? ([slug, 'patchCoherenceTask'] as const) : null,
    async (
      [resolvedSpaceSlug],
      {
        arg,
      }: {
        arg: Omit<PatchCoherenceTaskBySlugInput, 'slug'> & { slug: string };
      },
    ) => {
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Authentication required to update signal task');
      }

      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(
          resolvedSpaceSlug,
        )}/coherences/${encodeURIComponent(arg.slug)}/task`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...(arg.dueAt !== undefined ? { dueAt: arg.dueAt } : {}),
            ...(arg.progressStatus !== undefined
              ? { progressStatus: arg.progressStatus }
              : {}),
            ...(arg.board !== undefined ? { board: arg.board } : {}),
            ...(arg.assigneeIds !== undefined
              ? { assigneeIds: arg.assigneeIds }
              : {}),
            ...(arg.priority !== undefined ? { priority: arg.priority } : {}),
          }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string | { message?: string };
        } | null;
        const message =
          typeof payload?.error === 'string'
            ? payload.error
            : payload?.error &&
              typeof payload.error === 'object' &&
              typeof payload.error.message === 'string'
            ? payload.error.message
            : `Failed to patch task: ${response.status}`;
        throw new Error(message);
      }
      return hydrateCoherenceFromApi(await response.json()) as Coherence;
    },
  );

  return {
    patchTask: trigger,
    isPatching: isMutating,
    error,
  };
}
