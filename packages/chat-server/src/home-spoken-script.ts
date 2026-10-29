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
 * The card is placed first; words come after. A card-only step must keep
 * going so the spoken lines can land. A finished sentence that never called
 * the card still gets one more step so the card can attach.
 */
export function homeTurnShouldStop(steps: readonly HomeTurnStep[]): boolean {
  if (steps.length >= 3) return true;
  const latest = steps[steps.length - 1];
  const spoken = latest?.text?.trim() ?? '';
  // Card-first step: tool ran, no words yet — keep the turn open for speech.
  if (!spoken) return false;
  if (!homeSpokenScriptIsComplete(spoken)) return false;
  const cardShown = steps.some((step) => stepShowsHomeCard(step));
  if (!cardShown && steps.length < 2) return false;
  return true;
}
