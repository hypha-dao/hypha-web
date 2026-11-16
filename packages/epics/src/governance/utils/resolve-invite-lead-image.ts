/**
 * Prefer the document's own lead image. When a proposal has none, use the
 * hosting space banner so cards and detail views don't fall back to the
 * generic Hypha placeholder. The static placeholder is only used when the
 * space itself has no image (callers keep their own fallback in that case).
 *
 * `label` and `title` are accepted for callers that still pass them; fallback
 * is no longer limited to Invite or Quest.
 */
export function resolveInviteLeadImage({
  leadImage,
  spaceLeadImage,
}: {
  leadImage?: string | null;
  label?: string | null;
  title?: string | null;
  spaceLeadImage?: string | null;
}): string | undefined {
  const existing = leadImage?.trim();
  if (existing) return existing;

  const spaceImage = spaceLeadImage?.trim();
  return spaceImage || undefined;
}
