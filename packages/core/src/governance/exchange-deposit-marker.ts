/**
 * Structured marker appended to the description of the web2 agreement created
 * by the space-page "exchange deposit" flow. Allows the banner to find out
 * whether a deposit proposal for a specific escrow already exists in a space,
 * so it can hide itself and prevent duplicate submissions.
 */
const MARKER_PREFIX = 'exchange-deposit-escrow-id:';

/**
 * Wrap the marker in an MDX comment (`{/* ... *\/}`). MDX rejects HTML
 * comments (`<!-- ... -->`) with a parser error, which breaks the agreement
 * detail page when `next-mdx-remote-client` tries to compile the description.
 * The marker stays invisible in the rendered page but remains searchable via
 * plain-text scan.
 */
export const buildExchangeDepositEscrowMarker = (
  escrowId: bigint | number | string,
): string => `{/* ${MARKER_PREFIX}${escrowId.toString()} */}`;

/**
 * Extract the escrow id encoded in an agreement's description. Returns `null`
 * when the marker is missing or malformed. Matches both the current MDX
 * comment style and the legacy HTML comment style so descriptions written
 * before the MDX fix still de-duplicate correctly.
 */
export const extractExchangeDepositEscrowId = (
  description: string | null | undefined,
): string | null => {
  if (!description) return null;
  const match = description.match(
    new RegExp(`${MARKER_PREFIX}\\s*(\\d+)`, 'i'),
  );
  return match?.[1] ?? null;
};
