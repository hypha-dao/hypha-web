'use client';

import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { parseUnits } from 'viem';
import { getTokenDecimals } from '@hypha-platform/core/client';
import { hyphaTokenAbi, hyphaTokenAddress } from '../../../generated';
import { erc20Abi } from 'viem';
import { TOKENS } from '@hypha-platform/core/client';

type PaymentToken = 'USDC' | 'HYPHA';

interface ActivateSpacesInput {
  spaceIds: bigint[];
  amounts: number[];
  paymentToken: PaymentToken;
}

const TOKENS_SAFE = Array.isArray(TOKENS) ? TOKENS : [];
const USDC_TOKEN = TOKENS_SAFE.find((t) => t.symbol === 'USDC');

export const useActivateSpacesMutation = () => {
  const { client } = useSmartWallets();

  const {
    trigger: activateSpaces,
    isMutating,
    data: txHash,
    error,
    reset,
  } = useSWRMutation(
    'activateSpaces',
    async (_key, { arg }: { arg: ActivateSpacesInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const { spaceIds, amounts, paymentToken } = arg;

      if (!spaceIds.length || !amounts.length) {
        throw new Error('Empty spaceIds or amounts');
      }
      if (spaceIds.length !== amounts.length) {
        throw new Error('spaceIds and amounts length mismatch');
      }

      const paymentTokenAddress: `0x${string}` =
        paymentToken === 'USDC'
          ? (() => {
              if (!USDC_TOKEN?.address) {
                throw new Error(
                  'USDC token not configured: cannot proceed with USDC payment',
                );
              }
              return USDC_TOKEN.address;
            })()
          : (hyphaTokenAddress[8453] as `0x${string}`);

      const decimals = await getTokenDecimals(paymentTokenAddress);

      const parsedAmounts = amounts.map((a) =>
        parseUnits(a.toString(), decimals ?? 6),
      );

      if (paymentToken === 'USDC') {
        await client.writeContract({
          address: paymentTokenAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [
            hyphaTokenAddress[8453] as `0x${string}`,
            parsedAmounts.reduce((acc, val) => acc + val, 0n),
          ],
        });
      }

      const functionName =
        paymentToken === 'USDC' ? 'payForSpaces' : 'payInHypha';

      const tx = await client.writeContract({
        address: hyphaTokenAddress[8453] as `0x${string}`,
        abi: hyphaTokenAbi,
        functionName,
        args: [spaceIds, parsedAmounts],
      });

      return tx;
    },
  );

  return {
    activateSpaces,
    isActivating: isMutating,
    activationTxHash: txHash,
    activationError: error,
    resetActivation: reset,
  };
};
