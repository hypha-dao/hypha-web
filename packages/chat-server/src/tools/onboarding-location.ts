export function normalizeLocationChoice(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function isSkippedLocationAnswer(value: unknown): boolean {
  const normalized = normalizeLocationChoice(value);
  if (!normalized) return false;
  const exactSkips = new Set(['skip', 'no', 'none', 'skip location']);
  if (exactSkips.has(normalized)) return true;
  return (
    normalized.includes('no location') ||
    normalized.includes('prefer not') ||
    normalized.includes('not now') ||
    normalized.includes("don't want") ||
    normalized.includes('do not want')
  );
}

function isStructuredOnboardingLocation(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as {
    skipped?: unknown;
    latitude?: unknown;
    longitude?: unknown;
  };
  if (candidate.skipped === true) return true;
  return (
    typeof candidate.latitude === 'number' &&
    Number.isFinite(candidate.latitude) &&
    typeof candidate.longitude === 'number' &&
    Number.isFinite(candidate.longitude)
  );
}

/** Location is answered only via the map UI (structured coords) or an explicit skip. */
export function isAnsweredLocationStep(value: unknown): boolean {
  if (isSkippedLocationAnswer(value)) return true;
  return isStructuredOnboardingLocation(value);
}
