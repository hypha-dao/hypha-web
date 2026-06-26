'use client';

import useSWR, { mutate } from 'swr';
import useSWRMutation from 'swr/mutation';
import { useAuthentication } from '@hypha-platform/authentication';
import type { ScheduledItem } from '../../types';
import {
  createScheduledItemAction,
  deleteScheduledItemAction,
  updateScheduledItemAction,
} from '../../server/actions';

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

  const payload = (await response.json()) as { data: ScheduledItem[] };
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
  const {
    trigger: createScheduledItem,
    isMutating: isCreating,
    error: createError,
  } = useSWRMutation(
    authToken ? [authToken, 'createScheduledItem', spaceSlug, lang] : null,
    async ([token], { arg }: { arg: unknown }) =>
      createScheduledItemAction(arg, {
        authToken: token,
        spaceSlug,
        lang,
      }),
  );

  const {
    trigger: updateScheduledItem,
    isMutating: isUpdating,
    error: updateError,
  } = useSWRMutation(
    authToken ? [authToken, 'updateScheduledItem', spaceSlug, lang] : null,
    async ([token], { arg }: { arg: unknown }) =>
      updateScheduledItemAction(arg, {
        authToken: token,
        spaceSlug,
        lang,
      }),
  );

  const {
    trigger: deleteScheduledItem,
    isMutating: isDeleting,
    error: deleteError,
  } = useSWRMutation(
    authToken ? [authToken, 'deleteScheduledItem', spaceSlug] : null,
    async ([token], { arg }: { arg: { id: number } }) =>
      deleteScheduledItemAction(arg, { authToken: token, spaceSlug }),
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
