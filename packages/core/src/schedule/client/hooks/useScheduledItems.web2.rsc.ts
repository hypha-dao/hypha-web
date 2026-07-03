'use client';

import useSWR, { mutate } from 'swr';
import useSWRMutation from 'swr/mutation';
import { useAuthentication } from '@hypha-platform/authentication';
import type { PaginatedResponse } from '../../../common/types';
import type { ScheduledItem } from '../../types';

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

function buildScheduledItemUrl(spaceSlug: string, itemId?: number) {
  const base = `/api/v1/spaces/${encodeURIComponent(
    spaceSlug,
  )}/scheduled-items`;
  return itemId == null
    ? base
    : `${base}/${encodeURIComponent(String(itemId))}`;
}

function serializeScheduledItemBody(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const body = { ...payload };
  for (const key of ['startsAt', 'endsAt', 'recurrenceUntil'] as const) {
    const value = body[key];
    if (value instanceof Date) {
      body[key] = value.toISOString();
    }
  }
  return body;
}

async function readScheduledItemError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: string;
      details?: {
        fieldErrors?: Record<string, string[] | undefined>;
        formErrors?: string[];
      };
    };
    if (body.error?.trim()) return body.error.trim();
    const fieldMessages = body.details?.fieldErrors
      ? Object.values(body.details.fieldErrors).flatMap(
          (messages) => messages ?? [],
        )
      : [];
    const formMessages = body.details?.formErrors ?? [];
    const combined = [...formMessages, ...fieldMessages].filter(Boolean);
    if (combined.length > 0) return combined.join('; ');
  } catch {
    // fall through
  }
  return `${fallback} (${response.status})`;
}

async function scheduledItemsRequest(
  url: string,
  authToken: string,
  lang: string | undefined,
  init: RequestInit,
  fallbackError: string,
) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      ...(lang?.trim() ? { 'x-hypha-locale': lang.trim() } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await readScheduledItemError(response, fallbackError));
  }

  if (response.status === 204) {
    return null;
  }

  const payload = (await response.json()) as {
    data?: ScheduledItem;
    success?: boolean;
  };
  return payload.data ?? null;
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
  getAccessToken: () => Promise<string | null>,
  spaceSlug?: string,
  lang?: string,
) {
  const slug = spaceSlug?.trim() || null;
  const locale = lang?.trim() || 'en';

  const mutationBase = slug
    ? (['scheduled-item-mutations', slug, locale] as const)
    : null;

  async function requireAuthToken() {
    const authToken = await getAccessToken();
    if (!authToken) {
      throw new Error('You must be signed in to save calendar items');
    }
    return authToken;
  }

  const {
    trigger: createScheduledItem,
    isMutating: isCreating,
    error: createError,
  } = useSWRMutation(
    mutationBase ? ([...mutationBase, 'create'] as const) : null,
    async (_key, { arg }: { arg: unknown }) => {
      if (!slug) throw new Error('spaceSlug is required');
      const authToken = await requireAuthToken();
      const body = serializeScheduledItemBody(arg as Record<string, unknown>);
      return scheduledItemsRequest(
        buildScheduledItemUrl(slug),
        authToken,
        locale,
        {
          method: 'POST',
          body: JSON.stringify(body),
        },
        'Could not create scheduled item',
      );
    },
  );

  const {
    trigger: updateScheduledItem,
    isMutating: isUpdating,
    error: updateError,
  } = useSWRMutation(
    mutationBase ? ([...mutationBase, 'update'] as const) : null,
    async (_key, { arg }: { arg: unknown }) => {
      if (!slug) throw new Error('spaceSlug is required');
      const authToken = await requireAuthToken();
      const payload = arg as Record<string, unknown> & { id: number };
      const { id, ...patch } = payload;
      const body = serializeScheduledItemBody(patch);
      return scheduledItemsRequest(
        buildScheduledItemUrl(slug, id),
        authToken,
        locale,
        {
          method: 'PATCH',
          body: JSON.stringify(body),
        },
        'Could not update scheduled item',
      );
    },
  );

  const {
    trigger: deleteScheduledItem,
    isMutating: isDeleting,
    error: deleteError,
  } = useSWRMutation(
    mutationBase ? ([...mutationBase, 'delete'] as const) : null,
    async (_key, { arg }: { arg: { id: number } }) => {
      if (!slug) throw new Error('spaceSlug is required');
      const authToken = await requireAuthToken();
      return scheduledItemsRequest(
        buildScheduledItemUrl(slug, arg.id),
        authToken,
        locale,
        {
          method: 'DELETE',
        },
        'Could not delete scheduled item',
      );
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
