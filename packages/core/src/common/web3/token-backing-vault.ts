/** Chainlink asset price feeds for backing tokens (Base Mainnet) - by token address */
export const ASSET_PRICE_FEED_BY_TOKEN: Record<string, `0x${string}`> = {
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913':
    '0x7e860098F58bBFC8648a4311b374B1D669a2bc6B' as `0x${string}`,
  '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42':
    '0xDAe398520e2B67cd3f27aeF9Cf14D93D927f8250' as `0x${string}`,
  '0x4200000000000000000000000000000000000006':
    '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70' as `0x${string}`,
  '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf':
    '0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F' as `0x${string}`,
};

/** Chainlink currency feeds for redemption price (X/USD, address(0) = USD) */
export const CURRENCY_FEEDS = {
  USD: '0x0000000000000000000000000000000000000000' as const,
  EUR: '0xc91D87E81faB8f93699ECf7Ee9B44D11e1D53F0F' as const,
  GBP: '0xCceA6576904C118037695eB71195a5425E69Fa15' as const,
  CAD: '0xA840145F87572E82519d578b1F36340368a25D5d' as const,
  CHF: '0x3A1d6444fb6a402470098E23DaD0B7E86E14252F' as const,
  AUD: '0x46e51B8cA41d709928EdA9Ae43e42193E6CDf229' as const,
  NZD: '0x06bdFe07E71C476157FC025d3cCD4BBe08e83EF9' as const,
} as const;

export const CURRENCY_FEED_OPTIONS = [
  { value: CURRENCY_FEEDS.USD, label: 'USD' },
  { value: CURRENCY_FEEDS.EUR, label: 'EUR' },
  { value: CURRENCY_FEEDS.GBP, label: 'GBP' },
  { value: CURRENCY_FEEDS.CAD, label: 'CAD' },
  { value: CURRENCY_FEEDS.CHF, label: 'CHF' },
  { value: CURRENCY_FEEDS.AUD, label: 'AUD' },
  { value: CURRENCY_FEEDS.NZD, label: 'NZD' },
] as const;

/** address(0) for Hypha tokens — price read from token contract */
export const HYPH_TOKEN_PRICE_FEED =
  '0x0000000000000000000000000000000000000000' as const;

export const MAX_REDEMPTION_PERIOD_OPTIONS = [
  { value: 1, label: '1 day' },
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
] as const;

/** Map reference currency code to Chainlink feed (address(0) = USD). CNY, JPY, HKD fallback to USD. */
export function getPriceCurrencyFeed(currency?: string | null): `0x${string}` {
  if (!currency || currency === 'USD') return CURRENCY_FEEDS.USD;
  const feed = CURRENCY_FEEDS[currency as keyof typeof CURRENCY_FEEDS];
  return (feed ?? CURRENCY_FEEDS.USD) as `0x${string}`;
}

export function getPriceCurrencyCode(
  feed?: `0x${string}`,
): keyof typeof CURRENCY_FEEDS | undefined {
  if (!feed) return undefined;
  const normalizedFeed = feed.toLowerCase();
  return CURRENCY_FEED_OPTIONS.find(
    (option) => option.value.toLowerCase() === normalizedFeed,
  )?.label;
}
