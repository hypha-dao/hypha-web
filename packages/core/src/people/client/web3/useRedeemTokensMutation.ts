'use client';

import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { erc20Abi, parseUnits } from 'viem';
import {
  getTokenDecimals,
  ERC20_TOKEN_TRANSFER_ADDRESSES,
} from '@hypha-platform/core/client';
import { transferHelperAbi, transferHelperAddress } from '../../../generated';
import { CreateTransferInput } from '@hypha-platform/core/client';
import { createTransferAction } from '../../../transaction/server/actions';

interface RedeemTokensInput {
  redemptions: {
    token: string;
    amount: string;
  }[];
  conversions?: {
    asset?: string;
    percentage?: string;
  }[];
  memo?: string;
}

interface UseRedeemTokensProps {
  authToken?: string | null;
}

export const useRedeemTokensMutation = ({
  authToken,
}: UseRedeemTokensProps) => {
  const { client } = useSmartWallets();

  const {
    trigger: createTransferMutation,
    reset: resetCreateTransferMutation,
    isMutating: isCreatingTransfer,
    error: errorCreateTransferMutation,
    data: createdTransfer,
  } = useSWRMutation(
    authToken ? [authToken, 'createTransfer'] : null,
    async ([authToken], { arg }: { arg: CreateTransferInput }) =>
      createTransferAction(arg, { authToken }),
  );

  const {
    trigger: redeemTokens,
    reset: resetRedeemTokensMutation,
    isMutating: isRedeeming,
    data: redeemHashes,
    error: redeemError,
  } = useSWRMutation(
    'redeemTokens',
    async (_, { arg }: { arg: RedeemTokensInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      // TODO: Replace with actual redeem contract function when available
      // For now, simulate transfers to a vault address (placeholder)
      const vaultAddress = '0x0000000000000000000000000000000000000000'; // placeholder
      const results = [];

      for (const redemption of arg.redemptions) {
        const decimals = await getTokenDecimals(redemption.token);
        const amount = parseUnits(redemption.amount, decimals);
        // let txHash: string;
        let txHash: string = '0x0000000000000000000000000000000000000000'; //TODO: replace with actual txHash

        if (ERC20_TOKEN_TRANSFER_ADDRESSES.includes(redemption.token)) {
          /*txHash = await client.writeContract({
            address: redemption.token as `0x${string}`,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [vaultAddress as `0x${string}`, amount],
          });*/
        } else {
          /*txHash = await client.writeContract({
            address: transferHelperAddress[8453],
            abi: transferHelperAbi,
            functionName: 'transferToken',
            args: [
              redemption.token as `0x${string}`,
              vaultAddress as `0x${string}`,
              amount,
            ],
          });*/
        }

        results.push({ token: redemption.token, txHash });
      }

      if (arg.memo && authToken) {
        try {
          // Create a single transfer record for the first transaction (or all?)
          await createTransferMutation({
            transactionHash: results[0]?.txHash || '',
            memo: arg.memo,
          });
        } catch (error) {
          console.error('Failed to create transfer record:', error);
        }
      }

      return results;
    },
  );

  return {
    redeemTokens,
    resetRedeemTokensMutation,
    isRedeeming,
    redeemHashes,
    redeemError,
    createTransfer: createTransferMutation,
    resetCreateTransferMutation,
    isCreatingTransfer,
    errorCreateTransferMutation,
    createdTransfer,
  };
};
