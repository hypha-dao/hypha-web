/**
 * The Quest Helper indicator follows the latest turn.
 * A model turn shows it. A deterministic turn that replaces a pending model
 * hides it at once. Only that latest turn's completion may clear it, so a
 * stale model `finally` cannot hide a newer model turn or leave an older
 * indicator stuck after a deterministic turn.
 */
export function questHelperTypingForTurn(usesModel: boolean): boolean {
  return usesModel;
}

/** `false` clears the indicator. `null` leaves whatever the latest turn set. */
export function questHelperTypingAfterTurn(
  turnGeneration: number,
  latestGeneration: number,
): false | null {
  if (turnGeneration !== latestGeneration) return null;
  return false;
}
