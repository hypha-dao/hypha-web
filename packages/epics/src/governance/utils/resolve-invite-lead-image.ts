/**
 * Invite and Quest proposals skip a document lead image. Prefer the
 * document's own image when set; otherwise use the hosting space banner
 * so those cards don't fall back to the generic Hypha document placeholder.
 */
export function resolveInviteLeadImage({
  leadImage,
  label,
  title,
  spaceLeadImage,
}: {
  leadImage?: string | null;
  label?: string | null;
  title?: string | null;
  spaceLeadImage?: string | null;
}): string | undefined {
  const existing = leadImage?.trim();
  if (existing) return existing;

  const usesSpaceBanner =
    label === 'Invite' ||
    label === 'Quest' ||
    title === 'Invite Member' ||
    title === 'Invite Space';
  if (!usesSpaceBanner) return undefined;

  const spaceImage = spaceLeadImage?.trim();
  return spaceImage || undefined;
}
