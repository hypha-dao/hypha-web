'use client';

import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { erc20Abi, parseUnits } from 'viem';
import {
  getTokenDecimals,
  ERC20_TOKEN_TRANSFER_ADDRESSES,
} from '@hypha-platform/core/client';
import { transferHelperAbi, transferHelperAddress } from '../../../generated';

interface TransferTokensInput {
  recipient: string;
  payouts: {
    amount: string;
    token: string;
  }[];
}

export const useTransferTokensMutation = () => {
  const { client } = useSmartWallets();

  const {
    trigger: transferTokens,
    reset: resetTransferTokensMutation,
    isMutating: isTransferring,
    data: transferHashes,
    error: transferError,
  } = useSWRMutation(
    'transferTokens',
    async (_, { arg }: { arg: TransferTokensInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const transactionHashes = await Promise.all(
        arg.payouts.map(async (payout) => {
          const decimals = await getTokenDecimals(payout.token);
          const amount = parseUnits(payout.amount, decimals);
          let txHash: string;

          if (ERC20_TOKEN_TRANSFER_ADDRESSES.includes(payout.token)) {
            txHash = await client.writeContract({
              address: payout.token as `0x${string}`,
              abi: erc20Abi,
              functionName: 'transfer',
              args: [arg.recipient as `0x${string}`, amount],
            });
          } else {
            txHash = await client.writeContract({
              address: transferHelperAddress[8453],
              abi: transferHelperAbi,
              functionName: 'transferToken',
              args: [
                payout.token as `0x${string}`,
                arg.recipient as `0x${string}`,
                amount,
              ],
            });
          }

          return { token: payout.token, txHash };
        }),
      );

      return transactionHashes;
    },
  );

  return {
    transferTokens,
    resetTransferTokensMutation,
    isTransferring,
    transferHashes,
    transferError,
  };
};
