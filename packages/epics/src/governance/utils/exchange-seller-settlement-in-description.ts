const MARKER_PREFIX = '<!-- exchange-seller-settlement:';
const MARKER_SUFFIX = '-->';

function findSettlementSpan(
  description: string,
): { start: number; end: number; address: string } | null {
  let from = 0;
  while (from < description.length) {
    const start = description.indexOf(MARKER_PREFIX, from);
    if (start === -1) return null;
    const addrStart = start + MARKER_PREFIX.length;
    const suffixAt = description.indexOf(MARKER_SUFFIX, addrStart);
    if (suffixAt === -1) return null;
    const addrSlice = description.slice(addrStart, suffixAt).trim();
    if (/^0x[a-fA-F0-9]{40}$/i.test(addrSlice)) {
      return {
        start,
        end: suffixAt + MARKER_SUFFIX.length,
        address: addrSlice,
      };
    }
    from = addrStart;
  }
  return null;
}

/** Escrow party A when seller is a space (treasury executor), not the space contract. */
export function parseExchangeSellerSettlementAddressFromDescription(
  description?: string | null,
): string | undefined {
  if (!description) return undefined;
  const span = findSettlementSpan(description);
  return span?.address;
}

export function stripExchangeSellerSettlementComment(
  description: string,
): string {
  let cleaned = description;
  for (;;) {
    const span = findSettlementSpan(cleaned);
    if (!span) break;
    const sliceStart =
      span.start > 0 && cleaned[span.start - 1] === '\n'
        ? span.start - 1
        : span.start;
    const sliceEnd =
      span.end < cleaned.length && cleaned[span.end] === '\n'
        ? span.end + 1
        : span.end;
    cleaned = `${cleaned.slice(0, sliceStart)}${cleaned.slice(sliceEnd)}`;
  }
  return cleaned.trimEnd();
}
