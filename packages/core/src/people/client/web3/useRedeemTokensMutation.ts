'use client';

import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { erc20Abi, maxUint256, parseUnits } from 'viem';
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
  /**
   * Profile / member address (optional). Prefer resolving the allowance owner from
   * the Privy smart wallet client when available — it may differ from `person.address`.
   */
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
    smartWalletAddress
      ? ['redeemTokens', smartWalletAddress]
      : ['redeemTokens', 'pending'],
    async (_, { arg }: { arg: RedeemTokensInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const backingTokens: `0x${string}`[] = [];
      const proportions: bigint[] = [];

      const conversions = arg.conversions ?? [];
      for (let i = 0; i < conversions.length; i++) {
        const conversion = conversions[i]!;
        if (!conversion.asset?.trim() || !conversion.percentage?.trim()) {
          throw new Error(
            `Incomplete conversion at index ${i}: asset and percentage are required.`,
          );
        }
        backingTokens.push(conversion.asset as `0x${string}`);
        const percentage = percentageStringToBigInt(conversion.percentage);
        proportions.push(percentage);
      }

      // Vault expects proportions that match a full split; a single collateral must be 100%.
      // Kept as a safeguard when the form sends a remainder row that is not exactly 10000 bps.
      if (backingTokens.length === 1 && proportions.length === 1) {
        proportions[0] = 10000n;
      }

      const token = arg.redemption.token;
      const decimals = await getTokenDecimals(token);
      const amount = parseUnits(arg.redemption.amount, decimals);
      const vaultAddress = tokenBackingVaultImplementationAddress[
        REDEEM_CHAIN_ID
      ] as `0x${string}`;
      const spaceToken = token as `0x${string}`;

      const allowanceOwner =
        (client.account?.address as `0x${string}` | undefined) ??
        smartWalletAddress ??
        undefined;

      if (allowanceOwner) {
        const currentAllowance = await publicClient.readContract({
          address: spaceToken,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [allowanceOwner, vaultAddress],
        });
        if (currentAllowance < amount) {
          await client.writeContract({
            address: spaceToken,
            abi: erc20Abi,
            functionName: 'approve',
            args: [vaultAddress, maxUint256],
          });
        }
      } else {
        const owner =
          (client.account?.address as `0x${string}` | undefined) ??
          smartWalletAddress;
        if (!owner) {
          throw new Error(
            'Cannot approve redemption: wallet address is not available.',
          );
        }
        const currentAllowance = await publicClient.readContract({
          address: spaceToken,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [owner, vaultAddress],
        });
        if (currentAllowance < amount) {
          await client.writeContract({
            address: spaceToken,
            abi: erc20Abi,
            functionName: 'approve',
            args: [vaultAddress, maxUint256],
          });
        }
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
