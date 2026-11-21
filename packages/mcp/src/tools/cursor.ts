/**
 * The cursor is the offset of the next unseen item, so it keeps its meaning when `pageSize`
 * changes between calls (a page number would repeat or skip items).
 */
export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset })).toString('base64url');
}

export function decodeCursor(cursor: string | undefined): number | null {
  if (cursor === undefined) return 0;
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    return Number.isInteger(parsed?.o) && parsed.o >= 0 && parsed.o <= 1_000_000
      ? parsed.o
      : null;
  } catch {
    return null;
  }
}
