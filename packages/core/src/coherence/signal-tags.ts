/**
 * Tag identity for the signal board. Matching is case- and whitespace-insensitive
 * so "Memorandum", "memorandum", and " memorandum " are the same tag.
 */

export function normalizeTagKey(tag: string): string {
  return tag.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function displayTag(tag: string): string {
  return tag.trim().replace(/\s+/g, ' ');
}

export function tagsMatch(a: string, b: string): boolean {
  const left = normalizeTagKey(a);
  const right = normalizeTagKey(b);
  return left.length > 0 && left === right;
}

export function collectExistingTags(
  tagLists: ReadonlyArray<readonly string[] | null | undefined>,
): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const list of tagLists) {
    if (!list) continue;
    for (const raw of list) {
      if (typeof raw !== 'string') continue;
      const label = displayTag(raw);
      const key = normalizeTagKey(label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(label);
    }
  }
  return unique.sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

export function findNearDuplicateTags(
  candidate: string,
  existing: readonly string[],
): string[] {
  const key = normalizeTagKey(candidate);
  if (!key) return [];
  return existing.filter((tag) => normalizeTagKey(tag) === key);
}

export function isExistingTag(
  candidate: string,
  existing: readonly string[],
): boolean {
  return findNearDuplicateTags(candidate, existing).length > 0;
}

/** Replace every occurrence of `fromTag` with `toTag`, dropping exact duplicates. */
export function mergeTagInList(
  tags: readonly string[],
  fromTag: string,
  toTag: string,
): string[] {
  const fromKey = normalizeTagKey(fromTag);
  const toLabel = displayTag(toTag);
  const toKey = normalizeTagKey(toLabel);
  if (!fromKey || !toKey) return tags.map(displayTag).filter(Boolean);

  const seen = new Set<string>();
  const next: string[] = [];
  for (const raw of tags) {
    const label = tagsMatch(raw, fromTag) ? toLabel : displayTag(raw);
    const key = normalizeTagKey(label);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    next.push(label);
  }
  return next;
}

export function wouldCreateNearDuplicate(
  candidate: string,
  existing: readonly string[],
  selected: readonly string[] = [],
): boolean {
  const key = normalizeTagKey(candidate);
  if (!key) return false;
  if (selected.some((tag) => normalizeTagKey(tag) === key)) return false;
  return isExistingTag(candidate, existing);
}
