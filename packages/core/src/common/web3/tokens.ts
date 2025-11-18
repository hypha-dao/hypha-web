export type Token = {
  symbol: string;
  icon: string;
  address: `0x${string}`;
  name: string;
  type: 'liquid' | 'voice' | 'ownership' | 'utility' | 'credits' | null;
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
    icon: '/placeholder/hypha-token-icon.webp',
    address: '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3',
    name: 'Hypha',
    type: 'utility',
  },
];

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
] as const;
export type TokenType = (typeof validTokenTypes)[number];
