/**
 * Role stored when a new quest is published.
 * A blank or whitespace label uses the existing Member fallback.
 * The shared detail display does not invent that word for a blank stored role.
 */
export function draftParticipantRoleLabel(
  roleLabel: string | null | undefined,
): string {
  const trimmed = roleLabel?.trim() ?? '';
  return trimmed || 'Member';
}
