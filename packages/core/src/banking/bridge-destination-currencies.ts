/** Bridge-supported crypto destination currencies for fiat source rails. */
export const BRIDGE_DESTINATION_CURRENCIES = ['usdc', 'eurc'] as const;

export type BridgeDestinationCurrency =
  (typeof BRIDGE_DESTINATION_CURRENCIES)[number];

/**
 * Allowed destination currencies per Bridge source payment rail.
 * Order is presentation order (USDC first, EURC second when both are available).
 * @see https://apidocs.bridge.xyz/api-reference/virtual-accounts/create-a-virtual-account
 * @see https://apidocs.bridge.xyz/api-reference/transfers/create-a-transfer
 */
export const BRIDGE_DESTINATION_CURRENCIES_BY_SOURCE_RAIL: Readonly<
  Record<string, readonly BridgeDestinationCurrency[]>
> = {
  sepa: ['usdc', 'eurc'],
  spei: ['usdc', 'eurc'],
  ach: ['usdc'],
  ach_push: ['usdc'],
  wire: ['usdc'],
  pix: ['usdc'],
  faster_payments: ['usdc'],
  cop: ['usdc'],
};

export const BRIDGE_DESTINATION_PAYMENT_RAIL = 'base' as const;

export const BRIDGE_DEFAULT_DESTINATION_CURRENCY: BridgeDestinationCurrency =
  'usdc';

/** Default stablecoin when the source fiat currency allows it in the rail's option list. */
const BRIDGE_DEFAULT_DESTINATION_BY_SOURCE_CURRENCY: Readonly<
  Partial<Record<string, BridgeDestinationCurrency>>
> = {
  eur: 'eurc',
  usd: 'usdc',
};

export function getDestinationCurrenciesForSourceRail(
  sourceRail: string,
): readonly BridgeDestinationCurrency[] {
  const normalized = sourceRail.trim().toLowerCase();
  return (
    BRIDGE_DESTINATION_CURRENCIES_BY_SOURCE_RAIL[normalized] ?? [
      BRIDGE_DEFAULT_DESTINATION_CURRENCY,
    ]
  );
}

export function getDefaultDestinationCurrency(input: {
  sourceCurrency: string;
  sourceRail: string;
}): BridgeDestinationCurrency {
  const allowed = getDestinationCurrenciesForSourceRail(input.sourceRail);
  const preferred =
    BRIDGE_DEFAULT_DESTINATION_BY_SOURCE_CURRENCY[
      input.sourceCurrency.trim().toLowerCase()
    ];
  if (preferred && allowed.includes(preferred)) {
    return preferred;
  }
  return allowed[0] ?? BRIDGE_DEFAULT_DESTINATION_CURRENCY;
}

export function isAllowedBridgeDestinationCurrency(input: {
  sourceRail: string;
  destinationCurrency: string;
}): boolean {
  const allowed = getDestinationCurrenciesForSourceRail(input.sourceRail);
  return allowed.includes(
    input.destinationCurrency.toLowerCase() as BridgeDestinationCurrency,
  );
}

export function getBridgeBankingRailsConfig() {
  return {
    destinationCurrenciesBySourceRail:
      BRIDGE_DESTINATION_CURRENCIES_BY_SOURCE_RAIL,
    defaultDestinationCurrency: BRIDGE_DEFAULT_DESTINATION_CURRENCY,
    destinationPaymentRail: BRIDGE_DESTINATION_PAYMENT_RAIL,
    destinationCurrencies: BRIDGE_DESTINATION_CURRENCIES,
  };
}

export type BridgeBankingRailsConfig = ReturnType<
  typeof getBridgeBankingRailsConfig
>;
