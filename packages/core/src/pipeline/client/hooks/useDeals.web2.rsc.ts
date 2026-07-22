'use client';

import useSWR, { mutate } from 'swr';
import useSWRMutation from 'swr/mutation';
import { useAuthentication } from '@hypha-platform/authentication';
import type { Deal, DealFilters, UpdateDealInput } from '../../types';
import type { PipelineStatus } from '../../constants';

export const DEALS_SWR_KEY = 'pipeline-deals' as const;

export function revalidateDeals(spaceSlug?: string) {
  const normalizedSlug = spaceSlug?.trim() || null;
  return mutate(
    (key: unknown) =>
      Array.isArray(key) &&
      key[0] === DEALS_SWR_KEY &&
      (normalizedSlug == null || key[1] === normalizedSlug),
    undefined,
    { revalidate: true },
  );
}

function reviveDeal(deal: Deal): Deal {
  return {
    ...deal,
    createdAt: new Date(deal.createdAt),
    updatedAt: new Date(deal.updatedAt),
  };
}

function buildDealsUrl(spaceSlug: string, filters?: DealFilters): string {
  const params = new URLSearchParams();
  if (filters?.q) params.set('q', filters.q);
  if (filters?.ownerId != null) params.set('ownerId', String(filters.ownerId));
  if (filters?.accountManagerId != null) {
    params.set('accountManagerId', String(filters.accountManagerId));
  }
  if (filters?.tag) params.set('tag', filters.tag);
  if (filters?.hasDeadline != null) {
    params.set('hasDeadline', String(filters.hasDeadline));
  }
  const appendList = (key: string, value: string | string[] | undefined) => {
    if (!value) return;
    const list = Array.isArray(value) ? value : [value];
    list.forEach((item) => params.append(key, item));
  };
  appendList('swimlane', filters?.swimlane);
  appendList('region', filters?.region);
  appendList('country', filters?.country);
  appendList('priority', filters?.priority);
  appendList('status', filters?.status);
  appendList('pipelineStatus', filters?.pipelineStatus);

  const qs = params.toString();
  return `/api/v1/spaces/${encodeURIComponent(spaceSlug)}/deals${
    qs ? `?${qs}` : ''
  }`;
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

async function fetchDeals(
  spaceSlug: string,
  filters: DealFilters | undefined,
  getAccessToken: () => Promise<string | null>,
): Promise<Deal[]> {
  const response = await fetch(buildDealsUrl(spaceSlug, filters), {
    headers: await authHeaders(getAccessToken),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch deals: ${response.status}`);
  }
  const payload = (await response.json()) as { data: Deal[] };
  return payload.data.map(reviveDeal);
}

export function useDeals({
  spaceSlug,
  filters,
}: {
  spaceSlug?: string;
  filters?: DealFilters;
}) {
  const { getAccessToken } = useAuthentication();
  const slug = spaceSlug?.trim() || null;
  const filterKey = JSON.stringify(filters ?? {});

  const swrKey = slug ? ([DEALS_SWR_KEY, slug, filterKey] as const) : null;

  const {
    data,
    isLoading,
    error,
    mutate: refresh,
  } = useSWR(
    swrKey,
    async ([, resolvedSlug]) =>
      fetchDeals(resolvedSlug, filters, getAccessToken),
    {
      revalidateOnFocus: true,
      keepPreviousData: true,
      refreshInterval: 15_000,
      dedupingInterval: 5_000,
    },
  );

  return {
    deals: data ?? [],
    isLoading,
    error,
    refresh,
  };
}

export function useDealMutations(spaceSlug?: string) {
  const { getAccessToken } = useAuthentication();
  const slug = spaceSlug?.trim() || '';

  const createMutation = useSWRMutation(
    slug ? [DEALS_SWR_KEY, slug, 'create'] : null,
    async (_key, { arg }: { arg: Record<string, unknown> }) => {
      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(slug)}/deals`,
        {
          method: 'POST',
          headers: await authHeaders(getAccessToken),
          body: JSON.stringify(arg),
        },
      );
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          body.error || `Failed to create deal: ${response.status}`,
        );
      }
      const payload = (await response.json()) as { data: Deal };
      await revalidateDeals(slug);
      return reviveDeal(payload.data);
    },
  );

  const patchMutation = useSWRMutation(
    slug ? [DEALS_SWR_KEY, slug, 'patch'] : null,
    async (_key, { arg }: { arg: { id: number } & UpdateDealInput }) => {
      const { id, ...body } = arg;
      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(slug)}/deals/${id}`,
        {
          method: 'PATCH',
          headers: await authHeaders(getAccessToken),
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(
          errBody.error || `Failed to update deal: ${response.status}`,
        );
      }
      const payload = (await response.json()) as { data: Deal };
      await revalidateDeals(slug);
      return reviveDeal(payload.data);
    },
  );

  const deleteMutation = useSWRMutation(
    slug ? [DEALS_SWR_KEY, slug, 'delete'] : null,
    async (_key, { arg }: { arg: { id: number } }) => {
      const response = await fetch(
        `/api/v1/spaces/${encodeURIComponent(slug)}/deals/${arg.id}`,
        {
          method: 'DELETE',
          headers: await authHeaders(getAccessToken),
        },
      );
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(
          errBody.error || `Failed to delete deal: ${response.status}`,
        );
      }
      await revalidateDeals(slug);
      return true;
    },
  );

  const patchDealOptimistic = async (
    id: number,
    patch: UpdateDealInput,
  ): Promise<Deal> => {
    await mutate(
      (key: unknown) =>
        Array.isArray(key) && key[0] === DEALS_SWR_KEY && key[1] === slug,
      (current: Deal[] | undefined) => {
        if (!current) return current;
        return current.map((deal) =>
          deal.id === id ? { ...deal, ...patch, updatedAt: new Date() } : deal,
        );
      },
      { revalidate: false },
    );
    try {
      return await patchMutation.trigger({ id, ...patch });
    } catch (err) {
      // Roll the optimistic write back to server state on failure.
      await revalidateDeals(slug);
      throw err;
    }
  };

  const moveDealToStatus = (id: number, pipelineStatus: PipelineStatus) =>
    patchDealOptimistic(id, { pipelineStatus });

  return {
    createDeal: createMutation.trigger,
    isCreating: createMutation.isMutating,
    patchDeal: patchDealOptimistic,
    isPatching: patchMutation.isMutating,
    moveDealToStatus,
    deleteDeal: deleteMutation.trigger,
    isDeleting: deleteMutation.isMutating,
  };
}
