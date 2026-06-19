export type OnboardingConfirmationContext = {
  lastUserText?: string | null;
  recentUserTexts?: string[];
  setupPhase?: string | null;
};

const VISUAL_GENERATION_PATTERN =
  /\b(generate|create|make)\b.*\b(image|images|logo|banner|icon|visual|visuals|placeholder|placeholders)\b|\b(image|images|logo|banner|icon|visual|visuals|placeholder|placeholders)\b.*\b(generate|create|make)\b/i;
const VISUAL_NEGATION_PATTERN =
  /\b(no|not|don't|do not|without|skip)\b.*\b(image|images|logo|banner|icon|visual|visuals|placeholder|placeholders|generate|create|make)\b/i;

export function hasOnboardingConfirmation(
  ctx: OnboardingConfirmationContext,
  token: string,
): boolean {
  const candidates = [ctx.lastUserText, ...(ctx.recentUserTexts ?? [])].filter(
    (value): value is string => typeof value === 'string' && !!value.trim(),
  );

  for (const text of candidates) {
    if (hasExplicitConfirmation(text, token)) return true;
  }

  return false;
}

export function wantsGeneratedVisualsFromText(
  text: string | null | undefined,
): boolean {
  if (!text?.trim()) return false;
  if (VISUAL_NEGATION_PATTERN.test(text)) return false;
  return VISUAL_GENERATION_PATTERN.test(text);
}

export function hasRecentVisualGenerationRequest(
  texts: string[] | null | undefined,
): boolean {
  if (!texts?.length) return false;
  return texts.some((text) => wantsGeneratedVisualsFromText(text));
}

export function inferVisualVibe(args: {
  visualVibe?: string | null;
  description?: string | null;
  title?: string | null;
}): string {
  const explicit = args.visualVibe?.trim();
  if (explicit) return explicit.slice(0, 200);

  const description = args.description?.trim();
  if (description) {
    const firstSentence = description.split(/[.!?]/)[0]?.trim();
    if (firstSentence) return firstSentence.slice(0, 200);
  }

  const title = args.title?.trim();
  if (title) return `${title}, community, purposeful`;
  return 'calm, visionary, community';
}

export function hasExplicitConfirmation(
  lastUserText: string | null | undefined,
  token: string,
): boolean {
  if (!lastUserText) return false;
  const normalized = lastUserText.trim().toLowerCase();
  const normalizedCompact = normalized
    .replace(/[.,!?;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const normalizedToken = token.trim().toLowerCase();
  if (!normalizedToken) return false;
  const escapedToken = normalizedToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const confirmationPattern = new RegExp(`^confirm\\s+${escapedToken}$`, 'i');
  if (
    confirmationPattern.test(normalized) ||
    confirmationPattern.test(normalizedCompact)
  ) {
    return true;
  }

  const plainAffirmatives = new Set([
    'yes',
    'y',
    'yep',
    'yeah',
    'sure',
    'ok',
    'okay',
    'confirm',
    'confirmed',
    'ready',
    'go ahead',
    'proceed',
    'yes proceed',
    'yes, proceed',
    'do it',
    'sounds good',
    'prompt signature',
    'sign',
    'signed',
    'already did',
    'done',
  ]);
  return (
    plainAffirmatives.has(normalized) ||
    plainAffirmatives.has(normalizedCompact)
  );
}
