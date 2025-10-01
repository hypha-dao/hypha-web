export type Token = {
  symbol: string;
  icon: string;
  address: `0x${string}`;
  name: string;
  type: 'liquid' | 'voice' | 'ownership' | 'utility' | 'credits';
  transferable?: boolean;
};

export const TOKENS: Token[] = [
  {
    symbol: 'USDC',
    icon: '/placeholder/usdc-icon.svg',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    name: 'USDC',
    type: 'utility',
    transferable: true,
  },
  {
    symbol: 'EURC',
    icon: '/placeholder/eurc-icon.svg',
    address: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42',
    name: 'EURC',
    type: 'utility',
    transferable: true,
  },
  {
    symbol: 'WETH',
    icon: '/placeholder/eth.svg',
    address: '0x4200000000000000000000000000000000000006',
    name: 'Ethereum',
    type: 'utility',
    transferable: true,
  },
  {
    symbol: 'cbBTC',
    icon: '/placeholder/btc.svg',
    address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    name: 'Bitcoin',
    type: 'utility',
    transferable: true,
  },
  {
    symbol: 'HYPHA',
    icon: '/placeholder/hypha-token-icon.webp',
    address: '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3',
    name: 'Hypha',
    type: 'utility',
  },
  {
    symbol: 'HVOICE',
    icon: '/placeholder/voice-token-icon.webp',
    address: '0x24E0b2bfee025D57A19f9daE4C3849a4A6bf9626',
    name: 'Hypha Voice',
    type: 'voice',
  },
  {
    symbol: 'HCREDITS',
    icon: '/placeholder/credits-token-icon.webp',
    address: '0xb8591aDE4ceDA2dd14B1924dC81D23B765C2820d',
    name: 'Hypha Cash Credits',
    type: 'credits',
  },
];

export const validTokenTypes = [
  'utility',
  'credits',
  'ownership',
  'voice',
] as const;
export type TokenType = (typeof validTokenTypes)[number];
