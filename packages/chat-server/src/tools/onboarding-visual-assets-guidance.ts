function normalizeChoice(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function wantsGeneratedPlaceholders(value: unknown): boolean {
  const normalized = normalizeChoice(value);
  return (
    normalized.includes('placeholder') ||
    normalized.includes('generate') ||
    normalized.includes('create for me') ||
    normalized.includes('create them') ||
    normalized.includes("don't have") ||
    normalized.includes('do not have') ||
    normalized.includes('not yet') ||
    normalized.includes('no logo') ||
    normalized.includes('no banner') ||
    normalized === 'no' ||
    normalized === 'no assets' ||
    normalized === 'nope'
  );
}

export function hasOwnAssets(value: unknown): boolean {
  const normalized = normalizeChoice(value);
  return (
    normalized.includes('i have') ||
    normalized.includes('upload') ||
    normalized.includes('use mine') ||
    normalized.includes('already have') ||
    normalized === 'yes' ||
    normalized === 'yep'
  );
}

export function isAnsweredVisualAssetsChoice(value: unknown): boolean {
  return hasOwnAssets(value) || wantsGeneratedPlaceholders(value);
}

const VISUAL_ASSETS_CONFIRMED_AFFIRMATIVES = new Set([
  'yes',
  'y',
  'yep',
  'yeah',
  'sure',
  'ok',
  'okay',
  'ready',
  'go ahead',
  'proceed',
  'do it',
  'confirmed',
  'confirm',
  'sounds good',
  'looks good',
  'looks great',
  'love it',
  'love them',
  'perfect',
  'great',
  'nice',
  'awesome',
  'use these',
  'use them',
  'keep these',
  'keep them',
  'good',
]);

/** True when the user accepted generated/uploaded logo + banner. */
export function isAnsweredVisualAssetsConfirmed(value: unknown): boolean {
  const normalized = normalizeChoice(value)
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return false;
  if (VISUAL_ASSETS_CONFIRMED_AFFIRMATIVES.has(normalized)) return true;
  return (
    normalized.includes('looks good') ||
    normalized.includes('looks great') ||
    normalized.includes('love it') ||
    normalized.includes('love them') ||
    normalized.includes('perfect') ||
    normalized.includes('confirm') ||
    normalized.includes('proceed') ||
    normalized.includes('use these') ||
    normalized.includes('use them') ||
    normalized.includes('keep these') ||
    normalized.includes('keep them') ||
    normalized.includes('works for me') ||
    normalized.includes('work for me')
  );
}

/**
 * When logo/banner URLs are already on conversation context, mark visual
 * guidance steps answered so onboarding_guidance does not re-ask.
 */
export function applyVisualAssetsToKnownAnswers(
  knownAnswers: Record<string, unknown>,
  opts: {
    visualAssets?: { logoUrl: string; leadImageUrl: string } | null;
    visualAssetsConfirmed?: boolean;
    lastUserText?: string | null;
  },
): void {
  if (!opts.visualAssets) return;

  if (knownAnswers.visual_assets_choice == null) {
    knownAnswers.visual_assets_choice = 'generate';
  }
  if (knownAnswers.visual_vibe == null) {
    knownAnswers.visual_vibe = 'generated from conversation';
  }
  if (knownAnswers.visual_assets_links == null) {
    knownAnswers.visual_assets_links = `${opts.visualAssets.logoUrl} ${opts.visualAssets.leadImageUrl}`;
  }

  if (knownAnswers.visual_assets_confirmed != null) return;

  if (
    opts.visualAssetsConfirmed === true ||
    isAnsweredVisualAssetsConfirmed(opts.lastUserText)
  ) {
    knownAnswers.visual_assets_confirmed = 'yes';
  }
}
