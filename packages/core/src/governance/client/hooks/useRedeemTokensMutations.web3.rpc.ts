'use client';

import useSWRMutation from 'swr/mutation';
import useSWR from 'swr';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { encodeFunctionData, erc20Abi, parseUnits } from 'viem';

import { getProposalFromLogs } from '../web3';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
  tokenBackingVaultImplementationAbi,
  tokenBackingVaultImplementationAddress,
} from '@hypha-platform/core/generated';
import {
  getTokenDecimals,
  getSpaceDetails,
  getSpaceMinProposalDuration,
  publicClient,
  percentageStringToBigInt,
} from '@hypha-platform/core/client';
import { getDuration } from '@hypha-platform/ui-utils';

export interface CreateRedeemTokensInput {
  proposalWeb3SpaceId: number;
  redemption: {
    vaultWeb3SpaceId?: number;
    amount: string;
    token: string;
  };
  conversions: {
    asset: string;
    percentage: string;
  }[];
}

const chainId = 8453;

export type RedeemProposalTransaction = {
  target: `0x${string}`;
  value: bigint;
  data: `0x${string}`;
};

export async function prepareRedeemProposalParams(
  arg: CreateRedeemTokensInput,
  chain: keyof typeof tokenBackingVaultImplementationAddress = chainId,
): Promise<{
  spaceId: bigint;
  duration: bigint;
  transactions: RedeemProposalTransaction[];
}> {
  const proposalSpaceId = BigInt(arg.proposalWeb3SpaceId);
  const vaultSpaceId = BigInt(
    arg.redemption.vaultWeb3SpaceId ?? arg.proposalWeb3SpaceId,
  );
  const spaceToken = arg.redemption.token as `0x${string}`;
  const vaultAddress = tokenBackingVaultImplementationAddress[chain];

  const duration = await publicClient.readContract(
    getSpaceMinProposalDuration({
      spaceId: proposalSpaceId,
    }),
  );

  const backingTokens: `0x${string}`[] = [];
  const proportions: bigint[] = [];

  for (const conversion of arg.conversions) {
    if (!conversion.asset || !conversion.percentage) {
      continue;
    }
    backingTokens.push(conversion.asset as `0x${string}`);
    const percentage = percentageStringToBigInt(conversion.percentage);
    proportions.push(percentage);
  }

  if (backingTokens.length === 0) {
    throw new Error(
      'At least one valid conversion with asset and percentage is required',
    );
  }

  const vaultExists = await publicClient.readContract({
    address: vaultAddress,
    abi: tokenBackingVaultImplementationAbi,
    functionName: 'vaultExists',
    args: [vaultSpaceId, spaceToken],
  });
  if (!vaultExists) {
    throw new Error(
      'The selected redemption token does not have an active backing vault.',
    );
  }

  const configuredBackingTokens = await publicClient.readContract({
    address: vaultAddress,
    abi: tokenBackingVaultImplementationAbi,
    functionName: 'getBackingTokens',
    args: [vaultSpaceId, spaceToken],
  });
  const configuredBackingSet = new Set(
    configuredBackingTokens.map((token) => token.toLowerCase()),
  );
  const invalidBackingTokens = backingTokens.filter(
    (token) => !configuredBackingSet.has(token.toLowerCase()),
  );
  if (invalidBackingTokens.length > 0) {
    throw new Error(
      'One or more selected conversion assets are not configured as backing tokens for this vault token.',
    );
  }

  const decimals = await getTokenDecimals(arg.redemption.token);
  const amount = parseUnits(arg.redemption.amount, decimals);

  const redeemCallData = encodeFunctionData({
    abi: tokenBackingVaultImplementationAbi,
    functionName: 'redeem',
    args: [vaultSpaceId, spaceToken, amount, backingTokens, proportions],
  });

  const transactions: RedeemProposalTransaction[] = [];

  const vaultConfig = await publicClient.readContract({
    address: vaultAddress,
    abi: tokenBackingVaultImplementationAbi,
    functionName: 'getVaultConfig',
    args: [vaultSpaceId, spaceToken],
  });
  if (vaultConfig.whitelistEnabled) {
    const spaceDetails = await publicClient.readContract(
      getSpaceDetails({ spaceId: proposalSpaceId }),
    );
    const executor = spaceDetails[9] as `0x${string}`;
    const isExecutorWhitelisted = await publicClient.readContract({
      address: vaultAddress,
      abi: tokenBackingVaultImplementationAbi,
      functionName: 'isWhitelisted',
      args: [vaultSpaceId, spaceToken, executor],
    });

    if (!isExecutorWhitelisted) {
      // Proposals execute via space executor, so whitelist it first.
      transactions.push({
        target: vaultAddress,
        value: 0n,
        data: encodeFunctionData({
          abi: tokenBackingVaultImplementationAbi,
          functionName: 'addToWhitelist',
          args: [vaultSpaceId, spaceToken, [executor]],
        }),
      });
    }
  }

  // Redeem pulls space tokens from the executor via transferFrom; authorize the vault first.
  transactions.push({
    target: spaceToken,
    value: 0n,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [vaultAddress as `0x${string}`, amount],
    }),
  });

  transactions.push({
    target: vaultAddress,
    value: BigInt(0),
    data: redeemCallData,
  });

  return {
    spaceId: proposalSpaceId,
    duration: duration && duration > 0 ? duration : getDuration(7),
    transactions,
  };
}

export const useRedeemTokensMutationsWeb3Rpc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();

  const {
    trigger: createRedeemTokens,
    reset: resetCreateRedeemTokensMutation,
    isMutating: isCreatingRedeemTokens,
    data: createRedeemTokensHash,
    error: errorCreateRedeemTokens,
  } = useSWRMutation(
    `createRedeemTokens-${proposalSlug}`,
    async (_, { arg }: { arg: CreateRedeemTokensInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }
      const { spaceId, duration, transactions } =
        await prepareRedeemProposalParams(arg, chainId);

      const proposalParams = {
        spaceId,
        duration,
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
    data: createdRedeemTokens,
    isLoading: isLoadingRedeemTokensFromTransaction,
    error: errorWaitRedeemTokensFromTransaction,
  } = useSWR(
    createRedeemTokensHash
      ? [createRedeemTokensHash, 'waitForRedeemTokens']
      : null,
    async ([hash]) => {
      const { logs } = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(logs);
    },
  );

  return {
    createRedeemTokens,
    resetCreateRedeemTokensMutation,
    isCreatingRedeemTokens,
    isLoadingRedeemTokensFromTransaction,
    errorCreateRedeemTokens,
    errorWaitRedeemTokensFromTransaction,
    createRedeemTokensHash,
    createdRedeemTokens,
  };
};
