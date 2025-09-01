'use client';

import { useCallback } from 'react';
import { useFundWallet as usePrivyFund } from '@privy-io/react-auth';
import { base, Chain } from 'viem/chains';

export interface UseFundWalletParams {
  address: `0x${string}`;
  chain?: Chain;
  title?: string;
  subtitle?: string;
}

export function useFundWallet({
  address,
  title,
  subtitle,
  chain = base,
}: UseFundWalletParams) {
  const { fundWallet: privyFundWallet } = usePrivyFund();

  const fundWallet = useCallback(async () => {
    try {
      await privyFundWallet(address, {
        chain,
        uiConfig: {
          receiveFundsTitle: title,
          receiveFundsSubtitle: subtitle,
        },
      });
    } catch (e) {
      console.error('Funding a wallet failed:', e);
    }
  }, [privyFundWallet, address, title, subtitle, chain]);

  return { fundWallet };
}
