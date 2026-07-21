'use client';

import useSWR, { mutate } from 'swr';
import useSWRMutation from 'swr/mutation';
import { useAuthentication } from '@hypha-platform/authentication';
import type {
  CreatePipelineSavedViewInput,
  PipelineSavedViewRecord,
  UpdatePipelineSavedViewInput,
} from '../../types';

export const PIPELINE_SAVED_VIEWS_SWR_KEY = 'pipeline-saved-views' as const;

export function revalidatePipelineSavedViews(spaceSlug?: string) {
  const normalizedSlug = spaceSlug?.trim() || null;
  return mutate(
    (key: unknown) =>
      Array.isArray(key) &&
      key[0] === PIPELINE_SAVED_VIEWS_SWR_KEY &&
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

function revive(view: PipelineSavedViewRecord): PipelineSavedViewRecord {
  return {
    ...view,
    createdAt: new Date(view.createdAt),
    updatedAt: new Date(view.updatedAt),
  };
}

export function usePipelineSavedViews(spaceSlug?: string) {
  const { getAccessToken } = useAuthentication();
  const slug = spaceSlug?.trim() || null;

  const {
    data,
    isLoading,
    error,
    mutate: refresh,
  } = useSWR(
    slug ? ([PIPELINE_SAVED_VIEWS_SWR_KEY, slug] as const) : null,
    async ([, resolvedSlug]) => {
      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(
          resolvedSlug,
        )}/pipeline/saved-views`,
        { headers: await authHeaders(getAccessToken) },
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch saved views: ${response.status}`);
      }
      const payload = (await response.json()) as {
        data: PipelineSavedViewRecord[];
      };
      return payload.data.map(revive);
    },
    { revalidateOnFocus: true },
  );

  const createMutation = useSWRMutation(
    slug ? [PIPELINE_SAVED_VIEWS_SWR_KEY, slug, 'create'] : null,
    async (
      _key,
      {
        arg,
      }: {
        arg: Omit<CreatePipelineSavedViewInput, 'spaceId' | 'personId'>;
      },
    ) => {
      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(slug!)}/pipeline/saved-views`,
        {
          method: 'POST',
          headers: await authHeaders(getAccessToken),
          body: JSON.stringify(arg),
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to create saved view: ${response.status}`);
      }
      await revalidatePipelineSavedViews(slug!);
      const payload = (await response.json()) as {
        data: PipelineSavedViewRecord;
      };
      return revive(payload.data);
    },
  );

  const updateMutation = useSWRMutation(
    slug ? [PIPELINE_SAVED_VIEWS_SWR_KEY, slug, 'update'] : null,
    async (
      _key,
      { arg }: { arg: { id: number } & UpdatePipelineSavedViewInput },
    ) => {
      const { id, ...body } = arg;
      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(
          slug!,
        )}/pipeline/saved-views/${id}`,
        {
          method: 'PATCH',
          headers: await authHeaders(getAccessToken),
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to update saved view: ${response.status}`);
      }
      await revalidatePipelineSavedViews(slug!);
      return true;
    },
  );

  const deleteMutation = useSWRMutation(
    slug ? [PIPELINE_SAVED_VIEWS_SWR_KEY, slug, 'delete'] : null,
    async (_key, { arg }: { arg: { id: number } }) => {
      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(slug!)}/pipeline/saved-views/${
          arg.id
        }`,
        {
          method: 'DELETE',
          headers: await authHeaders(getAccessToken),
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to delete saved view: ${response.status}`);
      }
      await revalidatePipelineSavedViews(slug!);
      return true;
    },
  );

  return {
    views: data ?? [],
    isLoading,
    error,
    refresh,
    createView: createMutation.trigger,
    updateView: updateMutation.trigger,
    deleteView: deleteMutation.trigger,
  };
}
