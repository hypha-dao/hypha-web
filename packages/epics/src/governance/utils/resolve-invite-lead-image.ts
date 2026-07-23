/**
 * Invite / join-request proposals skip the agreement form that defaults
 * `leadImage` to the space banner. Prefer the document's own image when set;
 * otherwise use the hosting space banner so Invite cards don't fall back to
 * the generic Hypha document placeholder.
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

  const isInvite =
    label === 'Invite' || title === 'Invite Member' || title === 'Invite Space';
  if (!isInvite) return undefined;

  const spaceImage = spaceLeadImage?.trim();
  return spaceImage || undefined;
}
