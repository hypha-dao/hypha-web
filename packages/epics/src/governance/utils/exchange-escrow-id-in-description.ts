const ESCROW_PREFIX = '<!-- exchange-escrow-id:';
const ESCROW_SUFFIX = '-->';

function findEscrowIdSpan(
  description: string,
): { start: number; end: number; id: string } | null {
  let from = 0;
  while (from < description.length) {
    const start = description.indexOf(ESCROW_PREFIX, from);
    if (start === -1) return null;
    const idStart = start + ESCROW_PREFIX.length;
    const suffixAt = description.indexOf(ESCROW_SUFFIX, idStart);
    if (suffixAt === -1) return null;
    const idSlice = description.slice(idStart, suffixAt).trim();
    if (/^\d+$/.test(idSlice)) {
      return {
        start,
        end: suffixAt + ESCROW_SUFFIX.length,
        id: idSlice,
      };
    }
    from = idStart;
  }
  return null;
}

/**
 * Persist on-chain escrow id in agreement description (member-seller flow funds after vote).
 */
export function upsertExchangeEscrowIdInDescription(
  description: string,
  escrowId: bigint,
): string {
  const token = `${ESCROW_PREFIX}${escrowId.toString()}${ESCROW_SUFFIX}`;
  const span = findEscrowIdSpan(description);
  if (span) {
    return (
      description.slice(0, span.start) + token + description.slice(span.end)
    );
  }
  return `${description.trimEnd()}\n\n${token}`;
}

export function parseExchangeEscrowIdFromDescription(
  description?: string | null,
): bigint | undefined {
  if (!description) return undefined;
  const span = findEscrowIdSpan(description);
  if (!span) return undefined;
  const idSlice = span.id;
  try {
    return BigInt(idSlice);
  } catch {
    return undefined;
  }
}
