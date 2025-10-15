'use client';

import useSWRMutation from 'swr/mutation';
import useSWR from 'swr';
import { encodeFunctionData, parseUnits } from 'viem';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import {
  getTokenDecimals,
  TOKENS,
  transactionSchema,
  schemaCreateProposalWeb3,
} from '@hypha-platform/core/client';
import {
  publicClient,
  getProposalFromLogs,
  createProposal,
  mapToCreateProposalWeb3Input,
  getSpaceMinProposalDuration,
} from '@hypha-platform/core/client';
import { hyphaTokenAbi, hyphaTokenAddress } from '../../../generated';
import { erc20Abi } from 'viem';
import { getDuration } from '@hypha-platform/ui-utils';
import z from 'zod';

const PAYMENT_TOKEN = TOKENS.find((t) => t.symbol === 'USDC');
const chainId = 8453;

interface InvestInHyphaInput {
  usdcAmount: string;
  spaceId: number;
}

export const useBuyHyphaTokensMutationsWeb3Rpc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();

  const {
    trigger: investInHypha,
    reset: resetInvestMutation,
    isMutating: isInvesting,
    data: investHash,
    error: investError,
  } = useSWRMutation(
    `buyHyphaTokens-${proposalSlug}`,
    async (_, { arg }: { arg: InvestInHyphaInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const duration = await publicClient.readContract(
        getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
      );

      const transactions: z.infer<typeof transactionSchema>[] = [];

      const usdcDecimals = await getTokenDecimals(
        PAYMENT_TOKEN?.address as `0x${string}`,
      );
      const amount = parseUnits(arg.usdcAmount, usdcDecimals ?? 6);

      transactions.push({
        target: PAYMENT_TOKEN?.address as `0x${string}`,
        value: 0,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [hyphaTokenAddress[chainId] as `0x${string}`, amount],
        }),
      });

      transactions.push({
        target: hyphaTokenAddress[chainId] as `0x${string}`,
        value: 0,
        data: encodeFunctionData({
          abi: hyphaTokenAbi,
          functionName: 'investInHypha',
          args: [amount],
        }),
      });

      const input = {
        spaceId: BigInt(arg.spaceId),
        duration: duration && duration > 0 ? duration : getDuration(4),
        transactions,
      };

      const parsedInput = schemaCreateProposalWeb3.parse(input);
      const proposalArgs = mapToCreateProposalWeb3Input(parsedInput);

      const txHash = await client.writeContract(createProposal(proposalArgs));
      return txHash;
    },
  );

  const {
    data: investmentData,
    isLoading: isLoadingInvestmentFromTx,
    error: errorWaitInvestmentFromTx,
  } = useSWR(investHash ? [investHash, 'waitFor'] : null, async ([hash]) => {
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return getProposalFromLogs(receipt.logs);
  });

  return {
    investInHypha,
    resetInvestMutation,
    isInvesting,
    investHash,
    investmentData,
    isLoadingInvestmentFromTx,
    errorWaitInvestmentFromTx,
    investError,
  };
};
