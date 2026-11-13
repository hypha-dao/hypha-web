/**
 * A signal whose slug equals its space slug is opened as the space channel.
 * Creation must refuse that slug so the thread never falls through.
 */
export function signalSlugMatchesSpaceSlug(
  signalSlug: string | null | undefined,
  spaceSlug: string | null | undefined,
): boolean {
  const signal = signalSlug?.trim() ?? '';
  const space = spaceSlug?.trim() ?? '';
  return signal.length > 0 && signal === space;
}
