import { makeSettlementUtils } from './exchange-settlement-in-description-shared';

const MARKER_PREFIX = '<!-- exchange-buyer-settlement:';

const { parseAddress, stripComment } = makeSettlementUtils(MARKER_PREFIX);

/** Party B on-chain for escrow when buyer is a space (treasury executor), not the space contract. */
export function parseExchangeBuyerSettlementAddressFromDescription(
  description?: string | null,
): string | undefined {
  return parseAddress(description);
}

export function stripExchangeBuyerSettlementComment(
  description: string,
): string {
  return stripComment(description);
}