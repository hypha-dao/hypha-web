import { AssetProvider, Erc20Provider, EthereumProvider } from './_asset-provider';
import { publicClient } from '@core/common';
import { Hex, erc20Abi } from 'viem';

export const formGetBalance = (token: Hex) => {
  return async (address: Hex) => {
    const contract = {
      address: token,
      abi: erc20Abi,
    } as const;

    const balance = await publicClient.multicall({
      blockTag: 'safe',
      contracts: [
        {
          ...contract,
          functionName: 'balanceOf',
          args: [address],
        },
        {
          ...contract,
          functionName: 'symbol',
        },
        {
          ...contract,
          functionName: 'decimals',
        }
      ]
    })

    const failure = balance.find(res => res.status === "failure");
    if (failure) {
      throw failure.error;
    }

    const [amount, symbol, decimals] = balance.map(obj => obj.result);
    return {
      amount: amount as bigint,
      symbol: symbol as string,
      decimals: decimals as number,
    };
  }
}

export const TOKENS: AssetProvider[] = [
  new EthereumProvider({
    slug: 'ETH',
    getBalance: async (address: Hex) => {
      const decimals = 18;
      const symbol = 'ETH';

      const amount = await publicClient.getBalance({
        blockTag: 'safe',
        address,
      })

      return { amount, decimals, symbol };
    }
  }),
  new Erc20Provider({
    token: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    getBalance: formGetBalance('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'),
    slug: 'USDC',
    name: 'USD Coin',
    icon: '/placeholder/usdc-icon.png',
  }),
  new Erc20Provider({
    token: '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42',
    getBalance: formGetBalance('0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42'),
    slug: 'EURC',
    name: 'EUR Coin',
    icon: '/placeholder/eurc-icon.png',
  }),
  new Erc20Provider({
    token: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    getBalance: formGetBalance('0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf'),
    slug: 'cbBTC',
    name: 'Conibase Wrapped BTC',
    icon: '/placeholder/cbBTC-icon.png'
  }),
]
