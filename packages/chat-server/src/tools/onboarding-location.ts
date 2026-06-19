export function normalizeLocationChoice(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function isSkippedLocationAnswer(value: unknown): boolean {
  const normalized = normalizeLocationChoice(value);
  if (!normalized) return false;
  return (
    normalized === 'skip' ||
    normalized === 'no' ||
    normalized === 'none' ||
    normalized.includes('skip') ||
    normalized.includes('no location') ||
    normalized.includes('prefer not') ||
    normalized.includes('not now') ||
    normalized.includes("don't want") ||
    normalized.includes('do not want')
  );
}

export function isAnsweredLocationStep(value: unknown): boolean {
  if (isSkippedLocationAnswer(value)) return true;
  if (typeof value === 'string') return value.trim().length > 0;
  return value != null;
}
