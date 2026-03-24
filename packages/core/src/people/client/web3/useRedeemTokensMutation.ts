'use client';

import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { erc20Abi, parseUnits } from 'viem';
import {
  getTokenDecimals,
  ERC20_TOKEN_TRANSFER_ADDRESSES,
  percentageStringToBigInt,
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
        const percentage = percentageStringToBigInt(conversion.percentage);
        proportions.push(percentage);
      }

      const token = arg.redemption.token;
      const decimals = await getTokenDecimals(token);
      const amount = parseUnits(arg.redemption.amount, decimals);
      const txHash: string = await client.writeContract({
        address: tokenBackingVaultImplementationAddress[8453],
        abi: tokenBackingVaultImplementationAbi,
        functionName: 'redeem',
        args: [
          BigInt(arg.redemption.web3SpaceId),
          token as `0x${string}`,
          amount,
          backingTokens,
          proportions,
        ],
      });

      return { token, txHash };
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
