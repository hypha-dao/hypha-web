/**
 * Checks for the signal detail page of the white-label tree. Pure, so they can
 * be tested without the page.
 */

/** The slug as the page receives it: decoded when valid, trimmed. */
export function decodeSignalSlug(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

/**
 * Whether the signal belongs to the host's Space. A signal of another Space is
 * answered like an unknown slug (the caller renders the 404): the same check
 * as the main app's page. This is an existence check only; the content comes
 * from the Space's `coherences` route, which checks access.
 */
export function signalBelongsToSpace(
  signal: { spaceId?: number | null } | null | undefined,
  space: { id: number } | null | undefined,
): boolean {
  return Boolean(signal && space && signal.spaceId === space.id);
}
