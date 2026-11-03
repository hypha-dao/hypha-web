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

/** Speech attempts after a cut-off before we give up. */
const MAX_INCOMPLETE_SPEECH_STEPS = 3;

/** Absolute ceiling so a stuck model cannot loop forever. */
const MAX_HOME_TURN_STEPS = 6;

function stepShowsHomeCard(step: HomeTurnStep | undefined): boolean {
  return (step?.toolCalls ?? []).some(
    (call) => call?.toolName === HOME_CARD_TOOL,
  );
}

function speechStepCount(steps: readonly HomeTurnStep[]): number {
  return steps.filter((step) => (step.text?.trim() ?? '').length > 0).length;
}

/**
 * Stop once the spoken script ends on a sentence, or after enough speech tries.
 * The card is placed first and must not consume the unfinished-sentence budget —
 * otherwise "Alex, you raised a signal … about what it would take" stops mid-line.
 * A finished sentence that never called the card still gets one more step so the
 * card can attach.
 */
export function homeTurnShouldStop(steps: readonly HomeTurnStep[]): boolean {
  if (steps.length >= MAX_HOME_TURN_STEPS) return true;

  const latest = steps[steps.length - 1];
  const spoken = latest?.text?.trim() ?? '';
  // Card-first step: tool ran, no words yet — keep the turn open for speech.
  if (!spoken) return false;

  if (!homeSpokenScriptIsComplete(spoken)) {
    // Only spoken steps count. Card-only step 0 used to burn a "try" and leave
    // the cut-off with a single repair attempt.
    return speechStepCount(steps) >= MAX_INCOMPLETE_SPEECH_STEPS;
  }

  const cardShown = steps.some((step) => stepShowsHomeCard(step));
  if (!cardShown && steps.length < 2) return false;
  return true;
}
