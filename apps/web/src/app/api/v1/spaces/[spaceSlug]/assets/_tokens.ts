import { AssetProvider, Erc20Provider, EthereumProvider } from './_asset-provider';
import { publicClient } from '@core/common';

export const TOKENS: AssetProvider[] = [
  new EthereumProvider({
    client: publicClient,
    slug: 'ETH',
  }),
  new Erc20Provider({
    client: publicClient,
    token: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    slug: 'USDC',
    name: 'USD Coin',
    icon: '/placeholder/usdc-icon.png',
  }),
  new Erc20Provider({
    client: publicClient,
    token: '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42',
    slug: 'EURC',
    name: 'EUR Coin',
    icon: '/placeholder/eurc-icon.png',
  }),
  new Erc20Provider({
    client: publicClient,
    token: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    slug: 'cbBTC',
    name: 'Conibase Wrapped BTC',
    icon: '/placeholder/cbBTC-icon.png'
  }),
]
