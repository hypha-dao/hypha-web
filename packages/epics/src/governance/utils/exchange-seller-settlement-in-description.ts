import { makeSettlementUtils } from './exchange-settlement-in-description-shared';

const MARKER_PREFIX = '<!-- exchange-seller-settlement:';

const { parseAddress, stripComment } = makeSettlementUtils(MARKER_PREFIX);

/** Escrow party A when seller is a space (treasury executor), not the space contract. */
export function parseExchangeSellerSettlementAddressFromDescription(
  description?: string | null,
): string | undefined {
  return parseAddress(description);
}

export function stripExchangeSellerSettlementComment(
  description: string,
): string {
  return stripComment(description);
}