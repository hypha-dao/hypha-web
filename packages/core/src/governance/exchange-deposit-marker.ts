/**
 * Structured marker appended to the description of the web2 agreement created
 * by the space-page "exchange deposit" flow. Allows the banner to find out
 * whether a deposit proposal for a specific escrow already exists in a space,
 * so it can hide itself and prevent duplicate submissions.
 */
const MARKER_PREFIX = 'exchange-deposit-escrow-id:';

/**
 * Wrap the marker in an HTML comment so it remains invisible in rendered
 * markdown while still being searchable via plain-text scan.
 */
export const buildExchangeDepositEscrowMarker = (
  escrowId: bigint | number | string,
): string => `<!-- ${MARKER_PREFIX}${escrowId.toString()} -->`;

/**
 * Extract the escrow id encoded in an agreement's description. Returns `null`
 * when the marker is missing or malformed.
 */
export const extractExchangeDepositEscrowId = (
  description: string | null | undefined,
): string | null => {
  if (!description) return null;
  const match = description.match(new RegExp(`${MARKER_PREFIX}(\\d+)`, 'i'));
  return match?.[1] ?? null;
};
