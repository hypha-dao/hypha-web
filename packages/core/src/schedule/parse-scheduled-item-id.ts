export function parseScheduledItemId(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const id = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return id;
}
