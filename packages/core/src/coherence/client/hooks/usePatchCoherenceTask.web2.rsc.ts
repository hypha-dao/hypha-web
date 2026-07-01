'use client';

import useSWRMutation from 'swr/mutation';
import type { Coherence, PatchCoherenceTaskBySlugInput } from '../../types';
import { hydrateCoherenceFromApi } from '../../signal-workflow';
import { useJwt } from '../../../people/client/hooks/useJwt';

export function usePatchCoherenceTask(spaceSlug?: string) {
  const { jwt } = useJwt();

  const { trigger, isMutating, error } = useSWRMutation(
    jwt && spaceSlug ? ([spaceSlug, jwt, 'patchCoherenceTask'] as const) : null,
    async (
      [slug, token],
      {
        arg,
      }: {
        arg: Omit<PatchCoherenceTaskBySlugInput, 'slug'> & { slug: string };
      },
    ) => {
      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(
          slug,
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
          }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          payload?.error ?? `Failed to patch task: ${response.status}`,
        );
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
