'use client';

import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { erc20Abi, parseUnits } from 'viem';
import {
  getTokenDecimals,
  ERC20_TOKEN_TRANSFER_ADDRESSES,
} from '@hypha-platform/core/client';
import {
  tokenBackingVaultImplementationAddress,
  tokenBackingVaultImplementationAbi,
  transferHelperAbi,
  transferHelperAddress,
} from '../../../generated';
import { CreateTransferInput } from '@hypha-platform/core/client';
import { createTransferAction } from '../../../transaction/server/actions';

interface RedeemTokensInput {
  redemption: {
    web3SpaceId: number;
    token: string;
    amount: string;
  };
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

      const backingTokens: `0x${string}`[] = [];
      const proportions: bigint[] = [];

      for (const conversion of arg.conversions ?? []) {
        if (!conversion.asset || !conversion.percentage) {
          continue;
        }
        backingTokens.push(conversion.asset as `0x${string}`);
        const percentage = parseFloat(conversion.percentage) * 100; //TODO: replace with actual percentage
        proportions.push(BigInt(percentage));
      }

      const token = arg.redemption.token;
      const decimals = await getTokenDecimals(token);
      const amount = parseUnits(arg.redemption.amount, decimals);
      //TODO: uncomment before final testing
      /*const txHash: string = await client.writeContract({
        address: tokenBackingVaultImplementationAddress[8453],
        abi: tokenBackingVaultImplementationAbi,
        functionName: 'redeem',
        args: [
          BigInt(arg.redemption.web3SpaceId),
          token as `0x${string}`,
          BigInt(amount),
          backingTokens,
          proportions,
        ],
      });*/
      const txHash: string = '0x0x0000000000000000000000000000000000000000';
      console.log('redeem params:', [
        BigInt(arg.redemption.web3SpaceId),
        token as `0x${string}`,
        BigInt(amount),
        backingTokens,
        proportions,
      ]);
      const result = { token, txHash };

      if (arg.memo && authToken) {
        try {
          // Create a single transfer record for the first transaction (or all?)
          await createTransferMutation({
            transactionHash: result?.txHash || '',
            memo: arg.memo,
          });
        } catch (error) {
          console.error('Failed to create transfer record:', error);
        }
      }

      return result;
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
