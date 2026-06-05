export type BridgeDestinationMeta = {
  currency: string;
  paymentRail: string;
};

export function enrichBridgeDepositInstructions(
  instructions: Record<string, unknown>,
  meta?: {
    developerFeePercent?: string | null;
    destination?: BridgeDestinationMeta | null;
  },
): Record<string, unknown> {
  const enriched = { ...instructions };

  if (meta?.developerFeePercent != null && meta.developerFeePercent !== '') {
    enriched.developer_fee_percent = meta.developerFeePercent;
  }

  if (meta?.destination) {
    enriched.destination_currency = meta.destination.currency;
    enriched.destination_payment_rail = meta.destination.paymentRail;
  }

  return enriched;
}

export function readBridgeDestinationMeta(
  instructions: Record<string, unknown>,
  fallbackAddress: string,
): {
  currency: string;
  paymentRail: string;
  address: string;
} | null {
  if (!fallbackAddress) {
    return null;
  }

  const currency =
    typeof instructions.destination_currency === 'string'
      ? instructions.destination_currency
      : 'usdc';
  const paymentRail =
    typeof instructions.destination_payment_rail === 'string'
      ? instructions.destination_payment_rail
      : 'base';

  return {
    currency,
    paymentRail,
    address: fallbackAddress,
  };
}
