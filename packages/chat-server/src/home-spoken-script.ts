/** A home reply the voice can say through to the end. A dash or a colon is not an ending. */
export function homeSpokenScriptIsComplete(text: string): boolean {
  const spoken = text.trim();
  if (!spoken) return false;
  return /[.!?]["')\]]*$/u.test(spoken);
}

export type HomeTurnStep = {
  text?: string | null;
  toolCalls?: readonly { toolName?: string | null }[] | null;
};

const HOME_CARD_TOOL = 'show_member_home_item';

function stepShowsHomeCard(step: HomeTurnStep | undefined): boolean {
  return (step?.toolCalls ?? []).some(
    (call) => call?.toolName === HOME_CARD_TOOL,
  );
}

/**
 * Stop once the spoken script ends on a sentence, or after three tries.
 * A card tool often cuts the line mid-sentence. That turn is not finished.
 * A finished sentence that never called the card still gets one more step,
 * so the card can attach without the paragraph being said again.
 */
export function homeTurnShouldStop(steps: readonly HomeTurnStep[]): boolean {
  if (steps.length >= 3) return true;
  const latest = steps[steps.length - 1];
  const spoken = latest?.text?.trim() ?? '';
  if (!spoken) return false;
  if (!homeSpokenScriptIsComplete(spoken)) return false;
  const cardShown = steps.some((step) => stepShowsHomeCard(step));
  if (!cardShown && steps.length < 2) return false;
  return true;
}
