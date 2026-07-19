import type { Token } from './tokens';

/**
 * Energy-community ERC-20 assets that are deployed outside the regular /
 * ownership / decaying token factories (EnergyPPAv2). Without this catalogue
 * they never appear in space treasuries or profile wallets.
 *
 * `balanceDisplayDecimals` overrides on-chain ERC-20 decimals when formatting
 * balances for the UI. Legacy Ponta ownership tokens were minted as raw BPS
 * units (1% = 100) on an 18-decimal token, so they must be displayed with 0
 * decimals until communities are redeployed with scaled mint amounts.
 */
export type EnergyCommunityToken = Token & {
  balanceDisplayDecimals?: number;
};

/**
 * Keys are issuer space slugs (always listed on that treasury).
 * Addresses are Base mainnet.
 */
const PONTA_TOKENS: readonly EnergyCommunityToken[] = [
  {
    name: 'Community Energy Credit',
    symbol: 'NRG',
    address: '0x46bC7A3072a44A03a89b4017eaC00019e0E26D21',
    icon: '/placeholder/energy-credit-token-icon.svg',
    type: 'credits',
    transferable: true,
  },
  {
    name: 'School PV',
    symbol: 'SCHOOL',
    address: '0xdffeD605A5003184Edf2433412925df1668AF05A',
    icon: '/placeholder/solar-token-icon.svg',
    type: 'ownership',
    transferable: true,
    balanceDisplayDecimals: 0,
  },
  {
    name: 'Apartment PV',
    symbol: 'APARTM',
    address: '0x4F4a5cBAe998e15B105Afe585d2BA8B4b7b191B2',
    icon: '/placeholder/solar-token-icon.svg',
    type: 'ownership',
    transferable: true,
    balanceDisplayDecimals: 0,
  },
  {
    name: 'Battery',
    symbol: 'BATTER',
    address: '0x1F7F12A8eaA25E356fda6b4f79328C39134B74A1',
    icon: '/placeholder/battery-token-icon.svg',
    type: 'ownership',
    transferable: true,
    balanceDisplayDecimals: 0,
  },
];

const ENERGY_COMMUNITY_TOKENS_BY_SPACE: Record<
  string,
  readonly EnergyCommunityToken[]
> = {
  'ponta-do-sol-energy-community': PONTA_TOKENS,
  /** Alias slug used in some docs / early demos. */
  'ponta-do-sol': PONTA_TOKENS,
};

const ENERGY_COMMUNITY_TOKEN_BY_ADDRESS: Map<string, EnergyCommunityToken> =
  (() => {
    const map = new Map<string, EnergyCommunityToken>();
    for (const tokens of Object.values(ENERGY_COMMUNITY_TOKENS_BY_SPACE)) {
      for (const token of tokens) {
        map.set(token.address.toLowerCase(), token);
      }
    }
    return map;
  })();

export function getEnergyCommunityTokensForSpace(
  spaceSlug: string | null | undefined,
): readonly EnergyCommunityToken[] {
  if (!spaceSlug) return [];
  return ENERGY_COMMUNITY_TOKENS_BY_SPACE[spaceSlug] ?? [];
}

/** Deduped catalogue entries across all spaces. */
export function getAllEnergyCommunityTokens(): readonly EnergyCommunityToken[] {
  return [...ENERGY_COMMUNITY_TOKEN_BY_ADDRESS.values()];
}

export function getEnergyCommunityToken(
  address: string | null | undefined,
): EnergyCommunityToken | undefined {
  if (!address) return undefined;
  return ENERGY_COMMUNITY_TOKEN_BY_ADDRESS.get(address.toLowerCase());
}

export function isEnergyCommunityToken(
  address: string | null | undefined,
): boolean {
  return getEnergyCommunityToken(address) !== undefined;
}

/** Flat list of all catalogue energy-community token addresses (lowercased). */
export function getEnergyCommunityTokenAddresses(): ReadonlySet<string> {
  return new Set(ENERGY_COMMUNITY_TOKEN_BY_ADDRESS.keys());
}
