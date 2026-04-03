const ESCROW_ID_COMMENT = /<!--\s*exchange-escrow-id:(\d+)\s*-->/;

/**
 * Persist on-chain escrow id in agreement description (member-seller flow funds after vote).
 */
export function upsertExchangeEscrowIdInDescription(
  description: string,
  escrowId: bigint,
): string {
  const token = `<!-- exchange-escrow-id:${escrowId.toString()} -->`;
  if (ESCROW_ID_COMMENT.exec(description)) {
    return description.replace(ESCROW_ID_COMMENT, token);
  }
  return `${description.trimEnd()}\n\n${token}`;
}

export function parseExchangeEscrowIdFromDescription(
  description?: string | null,
): bigint | undefined {
  if (!description) return undefined;
  const m = ESCROW_ID_COMMENT.exec(description);
  if (!m?.[1]) return undefined;
  try {
    return BigInt(m[1]);
  } catch {
    return undefined;
  }
}
