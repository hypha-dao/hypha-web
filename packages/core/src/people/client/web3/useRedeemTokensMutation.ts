'use client';

import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { erc20Abi, parseUnits } from 'viem';
import {
  getTokenDecimals,
  percentageStringToBigInt,
  publicClient,
} from '@hypha-platform/core/client';
import {
  tokenBackingVaultImplementationAddress,
  tokenBackingVaultImplementationAbi,
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
  /** Smart wallet (token owner) — used to skip redundant approve after allowance is sufficient */
  smartWalletAddress?: `0x${string}` | null;
}

const REDEEM_CHAIN_ID = 8453;

export const useRedeemTokensMutation = ({
  authToken,
  smartWalletAddress,
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
      const vaultAddress = tokenBackingVaultImplementationAddress[
        REDEEM_CHAIN_ID
      ] as `0x${string}`;
      const spaceToken = token as `0x${string}`;

      if (smartWalletAddress) {
        const currentAllowance = await publicClient.readContract({
          address: spaceToken,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [smartWalletAddress, vaultAddress],
        });
        if (currentAllowance < amount) {
          await client.writeContract({
            address: spaceToken,
            abi: erc20Abi,
            functionName: 'approve',
            args: [vaultAddress, amount],
          });
        }
      } else {
        await client.writeContract({
          address: spaceToken,
          abi: erc20Abi,
          functionName: 'approve',
          args: [vaultAddress, amount],
        });
      }

      const txHash: string = await client.writeContract({
        address: vaultAddress,
        abi: tokenBackingVaultImplementationAbi,
        functionName: 'redeem',
        args: [
          BigInt(arg.redemption.web3SpaceId),
          spaceToken,
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
