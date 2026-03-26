'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { encodeFunctionData } from 'viem';

import { getProposalFromLogs } from '../web3';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
  decayingSpaceTokenAbi,
} from '@hypha-platform/core/generated';
import {
  getSpaceMinProposalDuration,
  publicClient,
} from '@hypha-platform/core/client';
import { getDuration } from '@hypha-platform/ui-utils';

interface TokenBurnRowInput {
  type: 'member' | 'space';
  address: `0x${string}`;
  amount?: string;
  allBalance?: boolean;
}

interface CreateTokenBurningInput {
  spaceId: number;
  tokenBurning: {
    token: `0x${string}`;
    burns: TokenBurnRowInput[];
  };
}

const DEFAULT_CHAIN_ID = 8453 as keyof typeof daoProposalsImplementationAddress;
const TOKEN_DECIMALS = 18;

const toTokenAmount = (amount: string) => {
  const normalizedAmount = amount.trim().replace(',', '.');
  const canonicalAmount = normalizedAmount.startsWith('.')
    ? `0${normalizedAmount}`
    : normalizedAmount.endsWith('.')
      ? `${normalizedAmount}0`
      : normalizedAmount;

  if (canonicalAmount.length === 0) {
    throw new Error('Please enter amount');
  }

  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(canonicalAmount)) {
    throw new Error('Invalid amount format');
  }

  const parts = canonicalAmount.split('.');
  const integerPartRaw = parts[0] ?? '';
  const fractionPartRaw = parts[1] ?? '';

  if (fractionPartRaw.length > TOKEN_DECIMALS) {
    throw new Error(`Amount supports up to ${TOKEN_DECIMALS} decimal places`);
  }

  const integerPart = integerPartRaw.replace(/^0+/, '') || '0';
  const fractionPart = fractionPartRaw.slice(0, TOKEN_DECIMALS);
  const paddedFractionPart = fractionPart.padEnd(TOKEN_DECIMALS, '0');

  const tokenAmount =
    BigInt(integerPart) * 10n ** BigInt(TOKEN_DECIMALS) +
    BigInt(paddedFractionPart);

  if (tokenAmount <= 0n) {
    throw new Error('Amount must be greater than 0');
  }

  return tokenAmount;
};

export const useTokenBurningMutationsWeb3Rsc = ({
  proposalSlug,
  chainId = DEFAULT_CHAIN_ID,
}: {
  proposalSlug?: string | null;
  chainId?: keyof typeof daoProposalsImplementationAddress;
}) => {
  const { client } = useSmartWallets();

  const {
    trigger: createTokenBurning,
    reset: resetCreateTokenBurningMutation,
    isMutating: isCreatingTokenBurning,
    data: createTokenBurningHash,
    error: errorCreateTokenBurning,
  } = useSWRMutation(
    `tokenBurning-${proposalSlug}`,
    async (_, { arg }: { arg: CreateTokenBurningInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const duration = await publicClient.readContract(
        getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
      );

      const burnTargets = await Promise.all(
        arg.tokenBurning.burns.map(async (row) => {
          if (row.allBalance) {
            const balance = await publicClient.readContract({
              address: arg.tokenBurning.token,
              abi: decayingSpaceTokenAbi,
              functionName: 'balanceOf',
              args: [row.address],
            });
            if (balance === 0n) {
              throw new Error(`Target has zero balance: ${row.address}`);
            }
            return { ...row, burnAmount: balance };
          }

          if (!row.amount || row.amount.trim() === '') {
            throw new Error('Please enter amount');
          }

          return { ...row, burnAmount: toTokenAmount(row.amount) };
        }),
      );

      const transactions = burnTargets.map((target) => ({
        target: arg.tokenBurning.token as `0x${string}`,
        value: 0n,
        data: encodeFunctionData({
          abi: decayingSpaceTokenAbi,
          functionName: 'burnFrom',
          args: [target.address, target.burnAmount],
        }),
      }));

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
    data: createdTokenBurning,
    isLoading: isLoadingTokenBurningFromTransaction,
    error: errorWaitTokenBurningFromTransaction,
  } = useSWR(
    createTokenBurningHash
      ? [createTokenBurningHash, 'waitForTokenBurning']
      : null,
    async ([hash]) => {
      const { logs } = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(logs);
    },
  );

  return {
    createTokenBurning,
    resetCreateTokenBurningMutation,
    isCreatingTokenBurning,
    createTokenBurningHash,
    errorCreateTokenBurning,
    isLoadingTokenBurningFromTransaction,
    errorWaitTokenBurningFromTransaction,
    createdTokenBurning,
  };
};
