/**
 * `?include=` parsing for `/api/v2` (K12): comma-separated named blocks, additive,
 * unknown name -> error (HTTP 400), no `include=all`. Framework-free.
 */

export type ParseIncludeResult<B extends string> =
  | { ok: true; blocks: ReadonlySet<B> }
  | { ok: false; unknown: string[]; allowed: readonly B[] };

export function parseInclude<B extends string>(
  raw: string | null | undefined,
  allowed: readonly B[],
): ParseIncludeResult<B> {
  const names = (raw ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

  const unknown = names.filter((name) => !allowed.includes(name as B));
  if (unknown.length > 0) {
    return { ok: false, unknown, allowed };
  }
  return { ok: true, blocks: new Set(names as B[]) };
}

export const SPACE_INCLUDE_BLOCKS = [
  'visibility',
  'governance',
  'counts',
] as const;
export type SpaceIncludeBlock = (typeof SPACE_INCLUDE_BLOCKS)[number];

/** `counts` is single-space only (the list already carries `memberCount` as in v1). */
export const SPACES_LIST_INCLUDE_BLOCKS = ['visibility', 'governance'] as const;
export type SpacesListIncludeBlock =
  (typeof SPACES_LIST_INCLUDE_BLOCKS)[number];

export const DOCUMENT_INCLUDE_BLOCKS = ['tally'] as const;
export type DocumentIncludeBlock = (typeof DOCUMENT_INCLUDE_BLOCKS)[number];
