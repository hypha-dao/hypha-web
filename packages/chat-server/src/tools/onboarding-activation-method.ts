export function normalizeOnboardingChoice(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

/** True only for explicit Sandbox / Pilot / Live (deployment) activation choices. */
export function isAnsweredActivationMethod(value: unknown): boolean {
  const normalized = normalizeOnboardingChoice(value);
  if (!normalized) return false;

  if (
    normalized === 'sandbox' ||
    normalized === 'pilot' ||
    normalized === 'deployment' ||
    normalized === 'live'
  ) {
    return true;
  }

  if (normalized.startsWith('activation mode:')) {
    return (
      normalized.includes('sandbox') ||
      normalized.includes('pilot') ||
      normalized.includes('live') ||
      normalized.includes('deployment')
    );
  }

  return (
    normalized.includes('sandbox mode') ||
    normalized.includes('pilot mode') ||
    normalized.includes('live mode')
  );
}
