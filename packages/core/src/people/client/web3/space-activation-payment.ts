import type { UsdRates } from '../../../common/web3/currency-conversion';
import { HYPHA_PRICE_USD, TOKENS } from '../../../common/web3/tokens';

export const SPACE_ACTIVATION_PAYMENT_TOKENS = [
  'HYPHA',
  'USDC',
  'EURC',
] as const;
export type SpaceActivationPaymentToken =
  (typeof SPACE_ACTIVATION_PAYMENT_TOKENS)[number];

/** Monthly HYPHA price used by both the personal and proposal renewal flows. */
export const HYPHA_PER_MONTH = 44;

/**
 * Tokens `HyphaToken.payForSpaces` / `payInHypha` actually pull on Base today.
 * EURC is catalogue-listed and shown in the UI, but the deployed contract has a
 * single `usdc` IERC20 (set in `initialize`, no setter) and no token argument.
 */
export const ONCHAIN_SPACE_RENEWAL_TOKENS = ['HYPHA', 'USDC'] as const;

export const EURC_NOT_SUPPORTED_ONCHAIN_CODE = 'EURC_NOT_SUPPORTED_ONCHAIN';
export const EURC_RATE_UNAVAILABLE_CODE = 'EURC_RATE_UNAVAILABLE';

/** Circle EURC on Base — https://developers.circle.com/stablecoins/eurc-contract-addresses */
export const EURC_BASE_ADDRESS =
  '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42' as const;

export type SpaceActivationLine = {
  spaceId: number;
  months: number;
  hypha: number;
  usdc: number;
  eurc: number | undefined;
};

export type SpaceActivationBreakdown = {
  items: SpaceActivationLine[];
  totalUSDC: number;
  totalHYPHA: number;
  totalEURC: number | undefined;
  eurUsdRate: number | undefined;
};

export function isSpaceActivationPaymentToken(
  value: string | null | undefined,
): value is SpaceActivationPaymentToken {
  return (
    value != null &&
    (SPACE_ACTIVATION_PAYMENT_TOKENS as readonly string[]).includes(value)
  );
}

export function isOnChainSpaceRenewalToken(
  token: SpaceActivationPaymentToken,
): token is (typeof ONCHAIN_SPACE_RENEWAL_TOKENS)[number] {
  return (ONCHAIN_SPACE_RENEWAL_TOKENS as readonly string[]).includes(token);
}

export function assertOnChainSpaceRenewalSupported(
  token: SpaceActivationPaymentToken,
): asserts token is (typeof ONCHAIN_SPACE_RENEWAL_TOKENS)[number] {
  if (!isOnChainSpaceRenewalToken(token)) {
    throw new Error(EURC_NOT_SUPPORTED_ONCHAIN_CODE);
  }
}

/**
 * Convert a USD-denominated renewal price to EURC.
 *
 * Does **not** fall back to 1:1 — `convertFromUsd` would, and that would
 * over/under-charge when the Chainlink EUR/USD feed is missing.
 */
export function convertUsdToEurc(
  usdAmount: number,
  eurUsdRate: number | undefined,
): number | undefined {
  if (!Number.isFinite(usdAmount) || usdAmount < 0) return undefined;
  if (eurUsdRate == null || !Number.isFinite(eurUsdRate) || eurUsdRate <= 0) {
    return undefined;
  }
  return +(usdAmount / eurUsdRate).toFixed(4);
}

export function getSpaceActivationUsdAmount(months: number): number {
  return +(months * HYPHA_PER_MONTH * HYPHA_PRICE_USD).toFixed(4);
}

export function getSpaceActivationHyphaAmount(months: number): number {
  return months * HYPHA_PER_MONTH;
}

export function getSpaceActivationBreakdown(
  spaces: ReadonlyArray<{ spaceId: number; months: number }>,
  rates: UsdRates = {},
): SpaceActivationBreakdown {
  const eurUsdRate =
    rates.EUR != null && rates.EUR > 0 && Number.isFinite(rates.EUR)
      ? rates.EUR
      : undefined;

  const items = spaces.map(({ spaceId, months }) => {
    const hypha = getSpaceActivationHyphaAmount(months);
    const usdc = getSpaceActivationUsdAmount(months);
    return {
      spaceId,
      months,
      hypha,
      usdc,
      eurc: convertUsdToEurc(usdc, eurUsdRate),
    };
  });

  const totalUSDC = +items.reduce((sum, item) => sum + item.usdc, 0).toFixed(4);
  const totalHYPHA = +items
    .reduce((sum, item) => sum + item.hypha, 0)
    .toFixed(4);
  const eurcValues = items.map((item) => item.eurc);
  const totalEURC = eurcValues.every((value) => value != null)
    ? +eurcValues.reduce((sum, value) => sum + (value ?? 0), 0).toFixed(4)
    : undefined;

  return { items, totalUSDC, totalHYPHA, totalEURC, eurUsdRate };
}

export function getSpaceActivationPaymentAmounts(
  breakdown: SpaceActivationBreakdown,
  paymentToken: SpaceActivationPaymentToken,
): number[] {
  if (paymentToken === 'HYPHA')
    return breakdown.items.map((item) => item.hypha);
  if (paymentToken === 'USDC') return breakdown.items.map((item) => item.usdc);
  if (breakdown.totalEURC == null) {
    throw new Error(EURC_RATE_UNAVAILABLE_CODE);
  }
  return breakdown.items.map((item) => item.eurc ?? 0);
}

export function getSpaceActivationTotal(
  breakdown: SpaceActivationBreakdown,
  paymentToken: SpaceActivationPaymentToken,
): number {
  if (paymentToken === 'HYPHA') return breakdown.totalHYPHA;
  if (paymentToken === 'EURC') return breakdown.totalEURC ?? 0;
  return breakdown.totalUSDC;
}

export function resolveSpaceActivationTokenAddress(
  paymentToken: SpaceActivationPaymentToken,
  hyphaAddress: `0x${string}`,
): `0x${string}` {
  if (paymentToken === 'HYPHA') return hyphaAddress;
  const token = TOKENS.find((entry) => entry.symbol === paymentToken);
  if (!token?.address) {
    throw new Error(`${paymentToken} token not configured`);
  }
  return token.address;
}

/** Sanity check that the catalogue EURC address is Circle's Base deployment. */
export function getCatalogueEurcAddress(): `0x${string}` | undefined {
  return TOKENS.find((token) => token.symbol === 'EURC')?.address;
}

export function getCatalogueUsdcAddress(): `0x${string}` | undefined {
  return TOKENS.find((token) => token.symbol === 'USDC')?.address;
}
