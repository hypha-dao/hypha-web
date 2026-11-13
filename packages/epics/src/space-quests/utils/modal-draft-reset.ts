/**
 * Reset a quest edit draft only on the closed → open transition.
 * A background refresh while the modal stays open must not replace
 * text the member is still editing.
 */
export function shouldResetQuestModalDraft(
  open: boolean,
  wasOpen: boolean,
): boolean {
  return open && !wasOpen;
}
