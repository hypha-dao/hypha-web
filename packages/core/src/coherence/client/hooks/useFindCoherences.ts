'use client';

import React from 'react';
import { useAuthentication } from '@hypha-platform/authentication';
import useSWR, { mutate } from 'swr';
import type { PaginatedResponse } from '@hypha-platform/core/client';
import { CoherenceType } from '../../coherence-types';
import { CoherenceTag } from '../../coherence-tags';
import { CoherencePriority } from '../../coherence-priorities';
import type { Coherence } from '../../types';

export interface CoherenceQuery {
  spaceSlug?: string;
  search?: string;
  type?: CoherenceType;
  tags?: CoherenceTag[];
  priority?: CoherencePriority;
  includeArchived?: boolean;
  orderBy?: 'mostrecent' | 'mostmessages' | 'mostviews' | 'mostupvoted';
}

const COHERENCES_REFRESH_MS = 60_000;
const COHERENCES_PAGE_SIZE = 100;

export const COHERENCES_SWR_KEY = 'coherences' as const;

export type PendingCoherenceTaskPatch = {
  progressStatus?: string | null;
  board?: string | null;
  priority?: CoherencePriority;
  /** After PATCH succeeds, stale list fetches older than this keep the overlay. */
  confirmedUpdatedAtMs?: number;
};

const pendingTaskPatches = new Map<string, PendingCoherenceTaskPatch>();

function pendingPatchKey(spaceSlug: string, slug: string): string {
  return `${spaceSlug.trim()}:${slug.trim()}`;
}

export function setPendingCoherenceTaskPatch(
  spaceSlug: string,
  slug: string,
  patch: PendingCoherenceTaskPatch,
): void {
  const key = pendingPatchKey(spaceSlug, slug);
  pendingTaskPatches.set(key, {
    ...pendingTaskPatches.get(key),
    ...patch,
  });
}

export function clearPendingCoherenceTaskPatch(
  spaceSlug: string,
  slug: string,
): void {
  pendingTaskPatches.delete(pendingPatchKey(spaceSlug, slug));
}

function itemUpdatedAtMs(item: Coherence): number {
  const raw = item.updatedAt;
  if (raw instanceof Date) return raw.getTime();
  return new Date(raw).getTime();
}

function fieldsMatchPending(
  item: Coherence,
  pending: PendingCoherenceTaskPatch,
): boolean {
  const statusOk =
    pending.progressStatus === undefined ||
    item.progressStatus === pending.progressStatus;
  const boardOk = pending.board === undefined || item.board === pending.board;
  const priorityOk =
    pending.priority === undefined || item.priority === pending.priority;
  return statusOk && boardOk && priorityOk;
}

function needsPendingOverlay(
  item: Coherence,
  pending: PendingCoherenceTaskPatch,
): boolean {
  if (!fieldsMatchPending(item, pending)) return true;
  if (pending.confirmedUpdatedAtMs == null) return false;
  return itemUpdatedAtMs(item) < pending.confirmedUpdatedAtMs;
}

function serverConfirmedOnFetch(
  item: Coherence,
  pending: PendingCoherenceTaskPatch,
): boolean {
  if (pending.confirmedUpdatedAtMs == null) return false;
  if (!fieldsMatchPending(item, pending)) return false;
  return itemUpdatedAtMs(item) >= pending.confirmedUpdatedAtMs;
}

type MergePendingOptions = {
  /** Only network refetches may drop overlays once the server has caught up. */
  fromFetch?: boolean;
};

/** Overlay in-flight task moves so stale SWR revalidations cannot snap cards back. */
export function mergePendingCoherenceTaskPatches(
  spaceSlug: string,
  items: Coherence[],
  options?: MergePendingOptions,
): Coherence[] {
  const trimmedSpace = spaceSlug.trim();
  if (!trimmedSpace || pendingTaskPatches.size === 0) return items;

  let changed = false;
  const next = items.map((item) => {
    const slug = item.slug?.trim();
    if (!slug) return item;
    const patchKey = pendingPatchKey(trimmedSpace, slug);
    const patch = pendingTaskPatches.get(patchKey);
    if (!patch) return item;

    if (!needsPendingOverlay(item, patch)) {
      if (options?.fromFetch && serverConfirmedOnFetch(item, patch)) {
        pendingTaskPatches.delete(patchKey);
      }
      return item;
    }

    changed = true;
    return { ...item, ...patch };
  });

  return changed ? next : items;
}

function touchCoherenceCache(spaceSlug: string): void {
  const trimmedSpaceSlug = spaceSlug.trim();
  if (!trimmedSpaceSlug) return;

  void mutate(
    (key) =>
      Array.isArray(key) &&
      key[0] === COHERENCES_SWR_KEY &&
      key[1] === trimmedSpaceSlug,
    (current) =>
      current?.length
        ? mergePendingCoherenceTaskPatches(trimmedSpaceSlug, current)
        : current,
    { revalidate: false },
  );
}

/** Register a pending task move and refresh the local SWR list immediately. */
export function applyPendingCoherenceTaskPatch(
  spaceSlug: string,
  slug: string,
  patch: PendingCoherenceTaskPatch,
): void {
  setPendingCoherenceTaskPatch(spaceSlug, slug, patch);
  touchCoherenceCache(spaceSlug);
}

/** Revalidate signal lists for a space (e.g. after create, edit, or delete). */
export function revalidateCoherences(spaceSlug?: string) {
  const normalizedSlug = spaceSlug?.trim() || null;
  return mutate(
    (key: unknown) =>
      Array.isArray(key) &&
      key[0] === COHERENCES_SWR_KEY &&
      (normalizedSlug == null || key[1] === normalizedSlug),
    undefined,
    { revalidate: true },
  );
}

/** Merge a patched signal into the local SWR list without a full refetch. */
export async function upsertCoherenceInSpaceCache(
  spaceSlug: string,
  updated: Coherence,
): Promise<boolean> {
  const trimmedSpaceSlug = spaceSlug.trim();
  const updatedSlug = updated.slug?.trim();
  if (!trimmedSpaceSlug || !updatedSlug) return false;

  let didUpdate = false;

  await mutate(
    (key) =>
      Array.isArray(key) &&
      key[0] === COHERENCES_SWR_KEY &&
      key[1] === trimmedSpaceSlug,
    (current) => {
      if (!current?.length) return current;
      let found = false;
      const next = current.map((item: Coherence) => {
        const itemSlug = item.slug?.trim();
        if (itemSlug !== updatedSlug) return item;
        found = true;
        return { ...item, ...updated };
      });
      if (found) didUpdate = true;
      return found
        ? mergePendingCoherenceTaskPatches(trimmedSpaceSlug, next)
        : current;
    },
    { revalidate: false },
  );

  return didUpdate;
}

function buildCoherencesUrl(
  spaceSlug: string,
  query: Omit<CoherenceQuery, 'spaceSlug'>,
  page: number,
): string {
  const params = new URLSearchParams();
  if (query.search?.trim()) params.set('search', query.search.trim());
  if (query.type) params.set('type', query.type);
  if (query.tags?.length) {
    for (const tag of query.tags) {
      params.append('tags', tag);
    }
  }
  if (query.priority) params.set('priority', query.priority);
  if (query.includeArchived) params.set('includeArchived', 'true');
  if (query.orderBy) params.set('orderBy', query.orderBy);
  params.set('page', String(page));
  params.set('pageSize', String(COHERENCES_PAGE_SIZE));
  const qs = params.toString();
  return `/api/v1/spaces/${encodeURIComponent(spaceSlug)}/coherences${
    qs ? `?${qs}` : ''
  }`;
}

async function fetchAllCoherences(
  spaceSlug: string,
  query: Omit<CoherenceQuery, 'spaceSlug'>,
  getAccessToken: () => Promise<string | null>,
): Promise<Coherence[]> {
  const headers: HeadersInit = {};
  const token = await getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const all: Coherence[] = [];
  let page = 1;

  while (true) {
    const url = buildCoherencesUrl(spaceSlug, query, page);
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to fetch coherences: ${response.status}`);
    }
    const payload = (await response.json()) as PaginatedResponse<Coherence>;
    all.push(...payload.data);
    if (!payload.pagination.hasNextPage) break;
    page += 1;
  }

  return mergePendingCoherenceTaskPatches(spaceSlug, all, { fromFetch: true });
}

export const useFindCoherences = ({
  spaceSlug,
  search,
  type,
  tags,
  priority,
  includeArchived,
  orderBy,
}: CoherenceQuery) => {
  const { getAccessToken } = useAuthentication();
  const slug = spaceSlug?.trim() || null;

  const swrKey = slug
    ? ([
        COHERENCES_SWR_KEY,
        slug,
        search ?? '',
        type ?? '',
        (tags ?? []).join(','),
        priority ?? '',
        includeArchived ? '1' : '0',
        orderBy ?? 'mostrecent',
      ] as const)
    : null;

  const {
    data: coherences,
    isLoading,
    error,
    mutate: refresh,
  } = useSWR(
    swrKey,
    async ([, resolvedSlug]) =>
      fetchAllCoherences(
        resolvedSlug,
        {
          search,
          type,
          tags,
          priority,
          includeArchived,
          orderBy,
        },
        getAccessToken,
      ),
    {
      refreshInterval: COHERENCES_REFRESH_MS,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      revalidateOnFocus: true,
      keepPreviousData: true,
      shouldRetryOnError: (err) => {
        if (err instanceof Error && err.message.includes('404')) return false;
        return true;
      },
      errorRetryCount: 2,
    },
  );

  const mergedCoherences = React.useMemo(
    () =>
      slug && coherences
        ? mergePendingCoherenceTaskPatches(slug, coherences)
        : coherences,
    [slug, coherences],
  );

  return {
    coherences: mergedCoherences,
    isLoading,
    error,
    refresh,
  };
};
