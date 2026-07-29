import type { Space } from '@hypha-platform/core/client';

const DEFAULT_TIMEOUT_MS = 12_000;

/** Paginate `/members` and return only space members (space-to-space). */
export async function fetchSpaceMemberSpaces(
  slug: string,
  headers: HeadersInit,
  options?: {
    maxPages?: number;
    pageSize?: number;
    signal?: AbortSignal;
    timeoutMs?: number;
  },
): Promise<Space[]> {
  const all: Space[] = [];
  let page = 1;
  const pageSize = options?.pageSize ?? 100;
  const maxPages = options?.maxPages ?? 20;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  for (let i = 0; i < maxPages; i++) {
    if (options?.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    const onOuterAbort = () => timeoutController.abort();
    options?.signal?.addEventListener('abort', onOuterAbort);

    try {
      const res = await fetch(
        `/api/v1/spaces/${encodeURIComponent(
          slug,
        )}/members?page=${page}&pageSize=${pageSize}`,
        {
          headers,
          signal: timeoutController.signal,
        },
      );
      if (!res.ok) {
        throw new Error(
          `Failed to fetch member spaces for ${slug}: ${res.status}`,
        );
      }
      const json = (await res.json()) as {
        spaces?: { data?: Space[]; pagination?: { hasNextPage?: boolean } };
      };
      all.push(...(json.spaces?.data ?? []));
      if (!json.spaces?.pagination?.hasNextPage) break;
      page += 1;
    } finally {
      clearTimeout(timeoutId);
      options?.signal?.removeEventListener('abort', onOuterAbort);
    }
  }

  return all;
}

export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let index = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (index < items.length) {
        const current = index++;
        results[current] = await worker(items[current]!);
      }
    },
  );
  await Promise.all(runners);
  return results;
}
