import { base } from 'viem/chains';
import { AssetProvider } from './_interface';
import { EthereumProvider, Erc20Provider } from './_asset-providers';
import { publicClient } from '@core/common';

export type ChainId = number;

export const ASSETS_PROVIDERS: Record<ChainId, AssetProvider[]> = {
  [base.id]: [
    new EthereumProvider(publicClient, { slug: 'ETH-1' }),
    new Erc20Provider(
      publicClient,
      "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      {
        slug: 'USDC',
        name: 'USD Coin',
        icon: '/placeholder/usdc-icon.png',
      },
    ),
    new Erc20Provider(
      publicClient,
      "0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42",
      {
        slug: 'EURC',
        name: 'EUR Coin',
        icon: '/placeholder/eurc-icon.png',
      },
    ),
    new Erc20Provider(
      publicClient,
      "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c",
      {
        slug: 'WBTC',
        name: 'Wrapped BTC',
        icon: '/placeholder/btc.png'
      }
    ),
  ],
} as const;
