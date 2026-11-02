/**
 * Whether the coherence panel is opening a signal's own thread rather than a
 * space channel. A signal thread must never fall back to the space room when
 * its room id is still unknown; it gets its own room instead.
 */
export function isSignalThreadJoin({
  coherenceSlug,
  spaceSlug,
  isPublic,
}: {
  coherenceSlug: string | null | undefined;
  spaceSlug: string | null | undefined;
  isPublic: boolean;
}): boolean {
  if (isPublic) return false;
  const slug = coherenceSlug?.trim() ?? '';
  if (!slug) return false;
  // A freshly created space room reopens with the space slug as its slug.
  return slug !== (spaceSlug?.trim() ?? '');
}
