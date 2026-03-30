'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { encodeFunctionData, erc20Abi, parseUnits } from 'viem';

import { getProposalFromLogs, parseEscrowCreatedIdsFromLogs } from '../web3';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@hypha-platform/core/generated';
import {
  getTokenDecimals,
  getSpaceMinProposalDuration,
  publicClient,
} from '@hypha-platform/core/client';
import { getDuration } from '@hypha-platform/ui-utils';
import { getGovernanceChainId } from './governance-chain-id';
import { EXCHANGE_ESCROW_CONTRACT_BY_CHAIN } from './exchange-escrow-contract';

const READ_TIMEOUT_MS = 30_000;

/** Proposer wallet must be the space executor when seller is the space (treasury funds escrow). */
export const EXCHANGE_SPACE_EXECUTOR_WALLET_REQUIRED =
  'EXCHANGE_SPACE_EXECUTOR_WALLET_REQUIRED';

/** Proposer wallet must match selected member seller address. */
export const EXCHANGE_SELLER_WALLET_MISMATCH =
  'EXCHANGE_SELLER_WALLET_MISMATCH';

async function withReadTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('RPC read timed out')), ms);
    promise
      .then((v) => {
        clearTimeout(id);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(id);
        reject(e);
      });
  });
}

interface ExchangeLegInput {
  amount: string;
  token: string;
}

interface CreateExchangeStakesAndTokensInput {
  spaceId: number;
  /** When `space`, proposal execution uses the space executor as party A for approve/fund. */
  sellerRecipientType?: 'member' | 'space';
  sellerAddress: string;
  buyerAddress: string;
  sellerLeg: ExchangeLegInput[];
  buyerLeg: ExchangeLegInput[];
}

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
  const chainId = getGovernanceChainId();
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

      const walletAddress = (
        client as { account?: { address?: `0x${string}` } }
      ).account?.address;
      if (!walletAddress) {
        throw new Error('Could not read connected wallet address');
      }

      if (arg.sellerRecipientType === 'space') {
        const factoryAddress = daoSpaceFactoryImplementationAddress[chainId];
        if (!factoryAddress) {
          throw new Error(`Space factory not configured for chain ${chainId}`);
        }
        const executor = await withReadTimeout(
          publicClient.readContract({
            address: factoryAddress,
            abi: daoSpaceFactoryImplementationAbi,
            functionName: 'getSpaceExecutor',
            args: [BigInt(arg.spaceId)],
          }),
          READ_TIMEOUT_MS,
        );
        if (
          typeof executor !== 'string' ||
          executor.toLowerCase() !== walletAddress.toLowerCase()
        ) {
          throw new Error(EXCHANGE_SPACE_EXECUTOR_WALLET_REQUIRED);
        }
      } else {
        if (arg.sellerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
          throw new Error(EXCHANGE_SELLER_WALLET_MISMATCH);
        }
      }

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

      const escrowAddress = EXCHANGE_ESCROW_CONTRACT_BY_CHAIN[chainId];
      if (!escrowAddress) {
        throw new Error(`Escrow contract not configured for chain ${chainId}`);
      }
      const proposalAddress = daoProposalsImplementationAddress[chainId];
      if (!proposalAddress) {
        throw new Error(
          `DAO proposals contract not configured for chain ${chainId}`,
        );
      }

      const duration = await withReadTimeout(
        publicClient.readContract(
          getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
        ),
        READ_TIMEOUT_MS,
      );

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
          const sellerTokenDecimals = await withReadTimeout(
            getTokenDecimals(sellerRow.token),
            READ_TIMEOUT_MS,
          );
          const buyerTokenDecimals = await withReadTimeout(
            getTokenDecimals(buyerRow.token),
            READ_TIMEOUT_MS,
          );

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
                args: [escrowAddress, BigInt(0)],
              }),
            },
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
        address: proposalAddress,
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
      const proposal = getProposalFromLogs(logs);
      const escrowIds = parseEscrowCreatedIdsFromLogs(logs);
      if (!proposal) {
        return proposal;
      }
      return {
        ...proposal,
        escrowIds,
        ...(escrowIds.length > 0 ? { escrowId: escrowIds[0] } : {}),
      };
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
