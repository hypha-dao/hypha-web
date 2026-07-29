/** Marks every ingested signal so the board can filter on provenance. */
export const EXTERNAL_SIGNAL_TAG = 'External Signal';

/**
 * Apply the provenance tag to a signal written by an integration.
 *
 * Used on update as well as creation: a patch replaces the whole tag list, so
 * an integration editing tags would otherwise strip the marker off its own
 * signal and make it indistinguishable from one authored in the Hypha UI.
 */
export function withExternalTag(tags: string[]): string[] {
  const alreadyTagged = tags.some(
    (tag) => tag.trim().toLowerCase() === EXTERNAL_SIGNAL_TAG.toLowerCase(),
  );
  return alreadyTagged ? tags : [...tags, EXTERNAL_SIGNAL_TAG];
}
