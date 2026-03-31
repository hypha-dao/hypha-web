'use client';

import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import useSWRMutation from 'swr/mutation';
import { getDuration } from '@hypha-platform/ui-utils';
import { encodeFunctionData } from 'viem';
import { decayingSpaceTokenAbi } from '../../../generated';
import useSWR from 'swr';
import {
  createProposal,
  getProposalFromLogs,
  getSpaceMinProposalDuration,
  mapToCreateProposalWeb3Input,
  publicClient,
  schemaCreateProposalWeb3,
} from '../../../client';
import { z } from 'zod';

export interface UpdateIssuedTokenInput {
  address: `0x${string}`;
  spaceId: number;
  name?: string;
  symbol?: string;
  maxSupply?: number;
  transferable?: boolean;
  decayPercentage?: number;
  decayInterval?: number;
  autoMinting?: boolean;
  tokenPrice?: number;
  priceCurrencyFeed?: `0x${string}`;
  useTransferWhitelist?: boolean;
  useReceiveWhitelist?: boolean;
  archiveToken?: boolean;
}

type ProposalTx = {
  target: `0x${string}`;
  value: number;
  data: `0x${string}`;
};

/** Encodes DecayingSpaceToken admin calls for a multisig proposal (no network I/O). */
export function buildUpdateIssuedTokenTxData(
  arg: UpdateIssuedTokenInput,
): ProposalTx[] {
  const txData: ProposalTx[] = [];

  const tokenPriceWei =
    arg.tokenPrice !== undefined ? BigInt(arg.tokenPrice) : 0n;
  const zeroFeed =
    '0x0000000000000000000000000000000000000000' as `0x${string}`;
  const priceCurrencyFeed = arg.priceCurrencyFeed ?? zeroFeed;

  if (arg.name !== undefined) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'setTokenName',
        args: [arg.name],
      }),
    });
  }
  if (arg.symbol !== undefined) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'setTokenSymbol',
        args: [arg.symbol],
      }),
    });
  }
  if (arg.maxSupply !== undefined) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'setMaxSupply',
        args: [BigInt(arg.maxSupply) * 10n ** 18n],
      }),
    });
  }
  if (arg.transferable !== undefined) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'setTransferable',
        args: [arg.transferable],
      }),
    });
  }
  if (arg.autoMinting !== undefined) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'setAutoMinting',
        args: [arg.autoMinting],
      }),
    });
  }
  if (arg.tokenPrice !== undefined) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'setPriceWithCurrency',
        args: [tokenPriceWei, priceCurrencyFeed],
      }),
    });
  }
  if (arg.decayPercentage !== undefined) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'setDecayPercentage',
        args: [BigInt(arg.decayPercentage)],
      }),
    });
  }
  if (arg.decayInterval !== undefined) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'setDecayInterval',
        args: [BigInt(arg.decayInterval)],
      }),
    });
  }
  if (arg.useTransferWhitelist !== undefined) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'setUseTransferWhitelist',
        args: [arg.useTransferWhitelist],
      }),
    });
  }
  if (arg.useReceiveWhitelist !== undefined) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'setUseReceiveWhitelist',
        args: [arg.useReceiveWhitelist],
      }),
    });
  }
  if (arg.archiveToken !== undefined) {
    txData.push({
      target: arg.address,
      value: 0,
      data: encodeFunctionData({
        abi: decayingSpaceTokenAbi,
        functionName: 'setArchived',
        args: [arg.archiveToken],
      }),
    });
  }

  return txData;
}

/**
 * `createProposal` reverts when the transaction list is empty. If the partial
 * update encodes no calls, include `setTokenName` with the current name (no
 * on-chain state change when it already matches).
 */
export function padUpdateIssuedTokenInputIfNoTxs(
  arg: UpdateIssuedTokenInput,
  currentName: string,
): UpdateIssuedTokenInput {
  if (buildUpdateIssuedTokenTxData(arg).length > 0) {
    return arg;
  }
  return { ...arg, name: currentName };
}

export const useUpdateIssuedTokenMutationsWeb3Rpc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();

  const {
    trigger: updateIssuedTokenMutation,
    reset: resetUpdateIssuedTokenMutation,
    isMutating: isUpdatingIssuedToken,
    error: errorUpdateIssuedTokenMutation,
    data: updateIssuedTokenHash,
  } = useSWRMutation(
    proposalSlug ? [proposalSlug, 'updateIssuedToken'] : null,
    async ([proposalSlug], { arg }: { arg: UpdateIssuedTokenInput }) => {
      if (!client) throw new Error('Smart wallet client not available');

      const duration = await publicClient.readContract(
        getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
      );

      const effectiveArg = padUpdateIssuedTokenInputIfNoTxs(
        arg,
        arg.name ?? '',
      );
      const txData = buildUpdateIssuedTokenTxData(effectiveArg);

      const proposal: z.infer<typeof schemaCreateProposalWeb3> = {
        spaceId: BigInt(arg.spaceId),
        duration: duration && duration > 0 ? duration : getDuration(4),
        transactions: txData,
      };
      const parsedProposal = schemaCreateProposalWeb3.parse(proposal);
      const proposalArgs = mapToCreateProposalWeb3Input(parsedProposal);
      const txHash = await client.writeContract(createProposal(proposalArgs));

      return txHash;
    },
  );

  const {
    data: updatedIssuedToken,
    isLoading: isLoadingTokenFromTx,
    error: errorWaitTokenFromTx,
  } = useSWR(
    updateIssuedTokenHash ? [updateIssuedTokenHash, 'waitFor'] : null,
    async ([hash]) => {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 300_000,
      });
      return getProposalFromLogs(receipt.logs);
    },
  );

  return {
    updateIssuedToken: updateIssuedTokenMutation,
    resetUpdateIssuedToken: resetUpdateIssuedTokenMutation,
    isUpdatingIssuedToken,
    updateIssuedTokenHash,
    errorUpdateIssuedToken: errorUpdateIssuedTokenMutation,
    updatedIssuedToken,
    isLoadingTokenFromTx,
    errorWaitTokenFromTx,
  };
};
