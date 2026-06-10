export type Token = {
  symbol: string;
  icon: string;
  address: `0x${string}`;
  name: string;
  type:
    | 'liquid'
    | 'voice'
    | 'ownership'
    | 'utility'
    | 'credits'
    | 'impact'
    | 'community_currency'
    | null;
  transferable?: boolean;
};

export const TOKENS: Token[] = [
  {
    symbol: 'USDC',
    icon: '/placeholder/usdc-icon.svg',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    name: 'USDC',
    type: null,
    transferable: true,
  },
  {
    symbol: 'EURC',
    icon: '/placeholder/eurc-icon.svg',
    address: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42',
    name: 'EURC',
    type: null,
    transferable: true,
  },
  {
    symbol: 'WETH',
    icon: '/placeholder/eth.svg',
    address: '0x4200000000000000000000000000000000000006',
    name: 'Ethereum',
    type: null,
    transferable: true,
  },
  {
    symbol: 'cbBTC',
    icon: '/placeholder/btc.svg',
    address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    name: 'Bitcoin',
    type: null,
    transferable: true,
  },
  {
    symbol: 'HYPHA',
    icon: '/placeholder/hypha-token-icon.svg',
    address: '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3',
    name: 'Hypha',
    type: 'utility',
  },
];

/**
 * Token contract addresses that must never be surfaced in the UI — treasury asset
 * lists, profile holdings, holder breakdowns, transfer pickers, vaults, etc.
 *
 * Use this to retire deprecated token deployments that can no longer be managed
 * through governance (e.g. legacy non-upgradeable contracts whose `burnFrom` lacks
 * the executor privilege the current proposal flow relies on). The on-chain token
 * still exists; this only stops the platform from displaying it.
 *
 * Addresses MUST be stored lowercased. Compare via {@link isHiddenToken}.
 */
export const HIDDEN_TOKEN_ADDRESSES: ReadonlySet<string> = new Set<string>([
  // Hypha Cash Credits (HCREDITS) — legacy non-upgradeable deployment for space 241
  // (Hypha Platform). Superseded by a new HCREDITS token issued through the current
  // RegularTokenFactory. The old contract cannot be upgraded or burned via proposal.
  '0xb8591ade4ceda2dd14b1924dc81d23b765c2820d',
  // Hypha Voice (HVOICE) — legacy non-upgradeable deployment for space 241 (Hypha
  // Platform), same older contract generation as HCREDITS. Not a proxy, so it cannot
  // be upgraded or burned via proposal.
  '0x24e0b2bfee025d57a19f9dae4c3849a4a6bf9626',
]);

/** True when `address` is on the {@link HIDDEN_TOKEN_ADDRESSES} denylist. */
export function isHiddenToken(address?: string | null): boolean {
  if (!address) return false;
  return HIDDEN_TOKEN_ADDRESSES.has(address.toLowerCase());
}

export const ERC20_TOKEN_TRANSFER_ADDRESSES = [
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42',
  '0x4200000000000000000000000000000000000006',
  '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
];

export const validTokenTypes = [
  'utility',
  'credits',
  'ownership',
  'voice',
  'impact',
  'community_currency',
] as const;
export type TokenType = (typeof validTokenTypes)[number];
