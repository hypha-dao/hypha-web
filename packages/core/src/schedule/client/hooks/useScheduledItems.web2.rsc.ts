'use client';

import useSWR, { mutate } from 'swr';
import useSWRMutation from 'swr/mutation';
import { useAuthentication } from '@hypha-platform/authentication';
import type { PaginatedResponse } from '../../common/types';
import type { ScheduledItem } from '../../types';
import {
  createScheduledItemAction,
  deleteScheduledItemAction,
  updateScheduledItemAction,
} from '../index';

export const SCHEDULED_ITEMS_SWR_KEY = 'scheduled-items' as const;

export function revalidateScheduledItems(spaceSlug?: string) {
  const normalizedSlug = spaceSlug?.trim() || null;
  return mutate(
    (key: unknown) =>
      Array.isArray(key) &&
      key[0] === SCHEDULED_ITEMS_SWR_KEY &&
      (normalizedSlug == null || key[1] === normalizedSlug),
    undefined,
    { revalidate: true },
  );
}

function buildScheduledItemsUrl(
  spaceSlug: string,
  from: Date,
  to: Date,
): string {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  return `/api/v1/spaces/${encodeURIComponent(
    spaceSlug,
  )}/scheduled-items?${params.toString()}`;
}

async function fetchScheduledItems(
  spaceSlug: string,
  from: Date,
  to: Date,
  getAccessToken: () => Promise<string | null>,
): Promise<ScheduledItem[]> {
  const headers: HeadersInit = {};
  const token = await getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildScheduledItemsUrl(spaceSlug, from, to), {
    headers,
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch scheduled items: ${response.status}`);
  }

  const payload = (await response.json()) as PaginatedResponse<ScheduledItem>;
  return payload.data.map((item) => ({
    ...item,
    startsAt: new Date(item.startsAt),
    endsAt: new Date(item.endsAt),
    recurrenceUntil: item.recurrenceUntil
      ? new Date(item.recurrenceUntil)
      : null,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  }));
}

export function useScheduledItems({
  spaceSlug,
  from,
  to,
}: {
  spaceSlug?: string;
  from: Date;
  to: Date;
}) {
  const { getAccessToken } = useAuthentication();
  const slug = spaceSlug?.trim() || null;

  const swrKey = slug
    ? ([
        SCHEDULED_ITEMS_SWR_KEY,
        slug,
        from.toISOString(),
        to.toISOString(),
      ] as const)
    : null;

  const {
    data,
    isLoading,
    error,
    mutate: refresh,
  } = useSWR(
    swrKey,
    async ([, resolvedSlug, fromIso, toIso]) =>
      fetchScheduledItems(
        resolvedSlug,
        new Date(fromIso),
        new Date(toIso),
        getAccessToken,
      ),
    {
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );

  return {
    scheduledItems: data,
    isLoading,
    error,
    refresh,
  };
}

export function useScheduledItemMutations(
  authToken?: string | null,
  spaceSlug?: string,
  lang?: string,
) {
  const mutationBase =
    spaceSlug?.trim() ?
      (['scheduled-item-mutations', spaceSlug.trim(), lang ?? 'en'] as const)
    : null;

  const {
    trigger: createScheduledItem,
    isMutating: isCreating,
    error: createError,
  } = useSWRMutation(
    mutationBase ? ([...mutationBase, 'create'] as const) : null,
    async (_key, { arg }: { arg: unknown }) => {
      if (!authToken) {
        throw new Error('authToken is required to create a scheduled item');
      }
      return createScheduledItemAction(arg, {
        authToken,
        spaceSlug,
        lang,
      });
    },
  );

  const {
    trigger: updateScheduledItem,
    isMutating: isUpdating,
    error: updateError,
  } = useSWRMutation(
    mutationBase ? ([...mutationBase, 'update'] as const) : null,
    async (_key, { arg }: { arg: unknown }) => {
      if (!authToken) {
        throw new Error('authToken is required to update a scheduled item');
      }
      return updateScheduledItemAction(arg, {
        authToken,
        spaceSlug,
        lang,
      });
    },
  );

  const {
    trigger: deleteScheduledItem,
    isMutating: isDeleting,
    error: deleteError,
  } = useSWRMutation(
    mutationBase ? ([...mutationBase, 'delete'] as const) : null,
    async (_key, { arg }: { arg: { id: number } }) => {
      if (!authToken) {
        throw new Error('authToken is required to delete a scheduled item');
      }
      return deleteScheduledItemAction(arg, { authToken, spaceSlug });
    },
  );

  return {
    createScheduledItem,
    updateScheduledItem,
    deleteScheduledItem,
    isCreating,
    isUpdating,
    isDeleting,
    createError,
    updateError,
    deleteError,
  };
}
