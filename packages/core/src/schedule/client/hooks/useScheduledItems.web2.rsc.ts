'use client';

import useSWR, { mutate } from 'swr';
import useSWRMutation from 'swr/mutation';
import { useAuthentication } from '@hypha-platform/authentication';
import type { PaginatedResponse } from '../../../common/types';
import type { ScheduledItem } from '../../types';
import { useJwt } from '../../../people/client/hooks/useJwt';

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
    page: '1',
    pageSize: '500',
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
  from?: Date | null;
  to?: Date | null;
}) {
  const { getAccessToken } = useAuthentication();
  const slug = spaceSlug?.trim() || null;
  const rangeReady =
    from instanceof Date &&
    to instanceof Date &&
    !Number.isNaN(from.getTime()) &&
    !Number.isNaN(to.getTime());

  const swrKey =
    slug && rangeReady
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
      dedupingInterval: 30_000,
    },
  );

  return {
    scheduledItems: data,
    isLoading,
    error,
    refresh,
  };
}

function buildScheduledItemsByCoherenceUrl(
  spaceSlug: string,
  coherenceId: number,
): string {
  const params = new URLSearchParams({
    coherenceId: String(coherenceId),
    page: '1',
    pageSize: '50',
  });
  return `/api/v1/spaces/${encodeURIComponent(
    spaceSlug,
  )}/scheduled-items?${params.toString()}`;
}

export function useScheduledItemsByCoherenceId({
  spaceSlug,
  coherenceId,
}: {
  spaceSlug?: string;
  coherenceId?: number | null;
}) {
  const { getAccessToken } = useAuthentication();
  const slug = spaceSlug?.trim() || null;
  const resolvedCoherenceId =
    typeof coherenceId === 'number' && coherenceId > 0 ? coherenceId : null;

  const swrKey =
    slug && resolvedCoherenceId
      ? ([
          SCHEDULED_ITEMS_SWR_KEY,
          slug,
          'coherence',
          resolvedCoherenceId,
        ] as const)
      : null;

  const {
    data,
    isLoading,
    error,
    mutate: refresh,
  } = useSWR(
    swrKey,
    async ([, resolvedSlug, , resolvedId]) => {
      const headers: HeadersInit = {};
      const token = await getAccessToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(
        buildScheduledItemsByCoherenceUrl(resolvedSlug, resolvedId),
        { headers },
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch linked events: ${response.status}`);
      }

      const payload =
        (await response.json()) as PaginatedResponse<ScheduledItem>;
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
    },
    {
      revalidateOnFocus: true,
    },
  );

  return {
    linkedEvents: data,
    isLoading,
    error,
    refresh,
  };
}

function serializeScheduledItemPayload(payload: Record<string, unknown>) {
  const serialized = { ...payload };
  for (const key of ['startsAt', 'endsAt', 'recurrenceUntil'] as const) {
    const value = serialized[key];
    if (value instanceof Date) {
      serialized[key] = value.toISOString();
    }
  }
  return serialized;
}

async function readScheduledItemMutationError(response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    details?: {
      formErrors?: string[];
      fieldErrors?: Record<string, string[] | undefined>;
    };
  } | null;

  const fieldMessage = payload?.details?.fieldErrors
    ? Object.values(payload.details.fieldErrors)
        .flatMap((messages) => messages ?? [])
        .find(Boolean)
    : undefined;

  return (
    fieldMessage ??
    payload?.details?.formErrors?.[0] ??
    payload?.error ??
    `Request failed (${response.status})`
  );
}

function mapScheduledItemResponse(row: ScheduledItem): ScheduledItem {
  return {
    ...row,
    startsAt: new Date(row.startsAt),
    endsAt: new Date(row.endsAt),
    recurrenceUntil: row.recurrenceUntil ? new Date(row.recurrenceUntil) : null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

export function useScheduledItemMutations(spaceSlug?: string, lang?: string) {
  const { jwt, isLoadingJwt } = useJwt();
  const slug = spaceSlug?.trim() || null;
  const locale = lang?.trim() || 'en';
  const mutationKey = jwt && slug ? ([slug, jwt, locale] as const) : null;

  const mutationHeaders = (token: string): HeadersInit => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-hypha-locale': locale,
  });

  const {
    trigger: createScheduledItem,
    isMutating: isCreating,
    error: createError,
  } = useSWRMutation(
    mutationKey ? ([...mutationKey, 'create'] as const) : null,
    async (
      [resolvedSlug, token, resolvedLocale],
      { arg }: { arg: unknown },
    ) => {
      const payload = serializeScheduledItemPayload(
        (arg ?? {}) as Record<string, unknown>,
      );
      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(resolvedSlug)}/scheduled-items`,
        {
          method: 'POST',
          headers: {
            ...mutationHeaders(token),
            'x-hypha-locale': resolvedLocale,
          },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok) {
        throw new Error(await readScheduledItemMutationError(response));
      }
      const body = (await response.json()) as { data: ScheduledItem };
      return mapScheduledItemResponse(body.data);
    },
  );

  const {
    trigger: updateScheduledItem,
    isMutating: isUpdating,
    error: updateError,
  } = useSWRMutation(
    mutationKey ? ([...mutationKey, 'update'] as const) : null,
    async (
      [resolvedSlug, token, resolvedLocale],
      { arg }: { arg: unknown },
    ) => {
      const input = (arg ?? {}) as Record<string, unknown> & { id?: number };
      const id = input.id;
      if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
        throw new Error('Scheduled item id is required');
      }

      const { id: _ignored, ...patch } = input;
      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(
          resolvedSlug,
        )}/scheduled-items/${id}`,
        {
          method: 'PATCH',
          headers: {
            ...mutationHeaders(token),
            'x-hypha-locale': resolvedLocale,
          },
          body: JSON.stringify(serializeScheduledItemPayload(patch)),
        },
      );
      if (!response.ok) {
        throw new Error(await readScheduledItemMutationError(response));
      }
      const body = (await response.json()) as { data: ScheduledItem };
      return mapScheduledItemResponse(body.data);
    },
  );

  const {
    trigger: deleteScheduledItem,
    isMutating: isDeleting,
    error: deleteError,
  } = useSWRMutation(
    mutationKey ? ([...mutationKey, 'delete'] as const) : null,
    async ([resolvedSlug, token], { arg }: { arg: { id: number } }) => {
      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(resolvedSlug)}/scheduled-items/${
          arg.id
        }`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      if (!response.ok) {
        throw new Error(await readScheduledItemMutationError(response));
      }
    },
  );

  return {
    createScheduledItem,
    updateScheduledItem,
    deleteScheduledItem,
    isCreating,
    isUpdating,
    isDeleting,
    isAuthReady: Boolean(jwt),
    isAuthLoading: isLoadingJwt,
    createError,
    updateError,
    deleteError,
  };
}
