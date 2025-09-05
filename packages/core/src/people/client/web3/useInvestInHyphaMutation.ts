'use client';

import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { parseUnits } from 'viem';
import { getTokenDecimals } from '@hypha-platform/core/client';
import { hyphaTokenAbi, hyphaTokenAddress } from '../../../generated';
import { TOKENS } from '@hypha-platform/core/client';
import { erc20Abi } from 'viem';

const PAYMENT_TOKEN = TOKENS.find((t) => t.symbol === 'USDC');

interface InvestInHyphaInput {
  usdcAmount: string;
}

export const useInvestInHyphaMutation = () => {
  const { client } = useSmartWallets();

  const {
    trigger: investInHypha,
    reset: resetInvestMutation,
    isMutating: isInvesting,
    data: investHash,
    error: investError,
  } = useSWRMutation(
    'investInHypha',
    async (_, { arg }: { arg: InvestInHyphaInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const usdcDecimals = await getTokenDecimals(
        PAYMENT_TOKEN?.address as `0x${string}`,
      );
      const amount = parseUnits(arg.usdcAmount, usdcDecimals);

      await client.writeContract({
        address: PAYMENT_TOKEN?.address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [hyphaTokenAddress[8453] as `0x${string}`, amount],
      });

      const txHash = await client.writeContract({
        address: hyphaTokenAddress[8453] as `0x${string}`,
        abi: hyphaTokenAbi,
        functionName: 'investInHypha',
        args: [amount],
      });

      return txHash;
    },
  );

  return {
    investInHypha,
    resetInvestMutation,
    isInvesting,
    investHash,
    investError,
  };
};
