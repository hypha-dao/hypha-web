'use client';

import { useCallback } from 'react';
import { useFundWallet as usePrivyFund } from '@privy-io/react-auth';
import { base, Chain } from 'viem/chains';

export interface UseFundWalletParams {
  /** When omitted, `fundWallet` is a no-op (safe for gated / loading UIs). */
  address?: `0x${string}`;
  chain?: Chain;
  /** Localized modal title; defaults to English fallback when omitted. */
  title?: string;
  /** Localized modal subtitle; defaults to English fallback when omitted. */
  subtitle?: string;
}

export function useFundWallet({
  address,
  // Keep English fallbacks for legacy callers; prefer passing localized copy.
  title = 'Receive Funds',
  subtitle = 'Share this QR code or wallet address to receive funds in this wallet.',
  chain = base,
}: UseFundWalletParams) {
  const { fundWallet: privyFundWallet } = usePrivyFund();

  const fundWallet = useCallback(async () => {
    if (!address) return;
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
