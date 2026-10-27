/** A home reply the voice can say through to the end. A dash or a colon is not an ending. */
export function homeSpokenScriptIsComplete(text: string): boolean {
  const spoken = text.trim();
  if (!spoken) return false;
  return /[.!?]["')\]]*$/u.test(spoken);
}

export type HomeTurnStep = {
  text?: string | null;
};

/**
 * Stop once the spoken script ends on a sentence, or after three tries.
 * A card tool often cuts the line mid-sentence. That turn is not finished.
 */
export function homeTurnShouldStop(steps: readonly HomeTurnStep[]): boolean {
  if (steps.length >= 3) return true;
  const latest = steps[steps.length - 1];
  const spoken = latest?.text?.trim() ?? '';
  if (!spoken) return false;
  return homeSpokenScriptIsComplete(spoken);
}
