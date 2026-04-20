const MARKER_SUFFIX = '-->';

type SettlementUtils = {
  parseAddress: (description?: string | null) => string | undefined;
  stripComment: (description: string) => string;
};

/**
 * Builds parse/strip helpers for an `<!-- exchange-*-settlement:0x… -->` marker.
 * Shared between the seller and buyer settlement utils so any change to the
 * marker format / address validation / newline handling stays in one place.
 */
export function makeSettlementUtils(markerPrefix: string): SettlementUtils {
  function findSettlementSpan(
    description: string,
  ): { start: number; end: number; address: string } | null {
    let from = 0;
    while (from < description.length) {
      const start = description.indexOf(markerPrefix, from);
      if (start === -1) return null;
      const addrStart = start + markerPrefix.length;
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

  function parseAddress(description?: string | null): string | undefined {
    if (!description) return undefined;
    return findSettlementSpan(description)?.address;
  }

  function stripComment(description: string): string {
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

  return { parseAddress, stripComment };
}
