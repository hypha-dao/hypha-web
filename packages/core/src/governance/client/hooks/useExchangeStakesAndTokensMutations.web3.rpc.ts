'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { encodeFunctionData, erc20Abi, parseUnits } from 'viem';

import { getProposalFromLogs } from '../web3';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '@hypha-platform/core/generated';
import {
  getTokenDecimals,
  getSpaceMinProposalDuration,
  publicClient,
} from '@hypha-platform/core/client';
import { getDuration } from '@hypha-platform/ui-utils';

interface ExchangeLegInput {
  amount: string;
  token: string;
}

interface CreateExchangeStakesAndTokensInput {
  spaceId: number;
  sellerAddress: string;
  buyerAddress: string;
  sellerLeg: ExchangeLegInput[];
  buyerLeg: ExchangeLegInput[];
}

const chainId = 8453;
const escrowAddressByChain: Record<number, `0x${string}`> = {
  [chainId]: '0x447A317cA5516933264Cdd6aeee0633Fa954B576',
};
const escrowCreateAbi = [
  {
    type: 'function',
    name: 'createEscrow',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_partyB', type: 'address', internalType: 'address' },
      { name: '_tokenA', type: 'address', internalType: 'address' },
      { name: '_tokenB', type: 'address', internalType: 'address' },
      { name: '_amountA', type: 'uint256', internalType: 'uint256' },
      { name: '_amountB', type: 'uint256', internalType: 'uint256' },
      { name: '_sendFundsNow', type: 'bool', internalType: 'bool' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
  },
] as const;

export const useExchangeStakesAndTokensMutationsWeb3Rpc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();

  const {
    trigger: createExchangeStakesAndTokens,
    reset: resetCreateExchangeStakesAndTokensMutation,
    isMutating: isCreatingExchangeStakesAndTokens,
    data: createExchangeStakesAndTokensHash,
    error: errorCreateExchangeStakesAndTokens,
  } = useSWRMutation(
    `createExchangeStakesAndTokens-${proposalSlug}`,
    async (_: string, { arg }: { arg: CreateExchangeStakesAndTokensInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }
      const escrowAddress = escrowAddressByChain[chainId];
      if (!escrowAddress) {
        throw new Error(`Escrow contract not configured for chain ${chainId}`);
      }

      const duration = await publicClient.readContract(
        getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
      );

      const sellerRows = arg.sellerLeg ?? [];
      const buyerRows = arg.buyerLeg ?? [];

      if (sellerRows.length === 0) {
        throw new Error('Seller must add at least one amount/token row');
      }
      if (buyerRows.length === 0) {
        throw new Error('Buyer must add at least one amount/token row');
      }
      if (sellerRows.length !== buyerRows.length) {
        throw new Error(
          'Seller and buyer rows must have the same count to build exchange escrows',
        );
      }

      const transactionGroups = await Promise.all(
        sellerRows.map(async (sellerRow, index) => {
          const buyerRow = buyerRows[index];
          if (!buyerRow) {
            throw new Error(
              `Missing buyer row ${
                index + 1
              }. Seller and buyer rows must be paired.`,
            );
          }

          const sellerTokenDecimals = await getTokenDecimals(sellerRow.token);
          const buyerTokenDecimals = await getTokenDecimals(buyerRow.token);

          const sellerAmount = parseUnits(
            sellerRow.amount,
            sellerTokenDecimals,
          );
          const buyerAmount = parseUnits(buyerRow.amount, buyerTokenDecimals);

          return [
            {
              target: sellerRow.token as `0x${string}`,
              value: BigInt(0),
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: 'approve',
                args: [escrowAddress, sellerAmount],
              }),
            },
            {
              target: escrowAddress,
              value: BigInt(0),
              data: encodeFunctionData({
                abi: escrowCreateAbi,
                functionName: 'createEscrow',
                args: [
                  arg.buyerAddress as `0x${string}`,
                  sellerRow.token as `0x${string}`,
                  buyerRow.token as `0x${string}`,
                  sellerAmount,
                  buyerAmount,
                  true,
                ],
              }),
            },
          ] as const;
        }),
      );

      const transactions = transactionGroups.flat();

      const proposalParams = {
        spaceId: BigInt(arg.spaceId),
        duration: duration && duration > 0 ? duration : getDuration(7),
        transactions,
      };

      const txHash = await client.writeContract({
        address: daoProposalsImplementationAddress[chainId],
        abi: daoProposalsImplementationAbi,
        functionName: 'createProposal',
        args: [proposalParams],
      });

      return txHash;
    },
  );

  const {
    data: createdExchangeStakesAndTokens,
    isLoading: isLoadingExchangeStakesAndTokensFromTransaction,
    error: errorWaitExchangeStakesAndTokensFromTransaction,
  } = useSWR(
    createExchangeStakesAndTokensHash
      ? [createExchangeStakesAndTokensHash, 'waitForExchangeStakesAndTokens']
      : null,
    async ([hash]) => {
      const { logs } = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(logs);
    },
  );

  return {
    createExchangeStakesAndTokens,
    resetCreateExchangeStakesAndTokensMutation,
    isCreatingExchangeStakesAndTokens,
    createExchangeStakesAndTokensHash,
    errorCreateExchangeStakesAndTokens,
    createdExchangeStakesAndTokens,
    isLoadingExchangeStakesAndTokensFromTransaction,
    errorWaitExchangeStakesAndTokensFromTransaction,
  };
};
