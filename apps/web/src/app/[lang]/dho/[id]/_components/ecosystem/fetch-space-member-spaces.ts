import type { Space } from '@hypha-platform/core/client';

/** Paginate `/members` and return only space members (space-to-space). */
export async function fetchSpaceMemberSpaces(
  slug: string,
  headers: HeadersInit,
  options?: { maxPages?: number; pageSize?: number },
): Promise<Space[]> {
  const all: Space[] = [];
  let page = 1;
  const pageSize = options?.pageSize ?? 100;
  const maxPages = options?.maxPages ?? 20;

  for (let i = 0; i < maxPages; i++) {
    const res = await fetch(
      `/api/v1/spaces/${encodeURIComponent(
        slug,
      )}/members?page=${page}&pageSize=${pageSize}`,
      { headers },
    );
    if (!res.ok) break;
    const json = (await res.json()) as {
      spaces?: { data?: Space[]; pagination?: { hasNextPage?: boolean } };
    };
    all.push(...(json.spaces?.data ?? []));
    if (!json.spaces?.pagination?.hasNextPage) break;
    page += 1;
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
