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

const USDC_TOKEN = TOKENS.find((t) => t.symbol === 'USDC');
const chainId = 8453;

type PaymentToken = 'USDC' | 'HYPHA';

interface ActivateInSpacesInput {
  spaceIds: number[];
  amounts: number[];
  paymentToken: PaymentToken;
  spaceId: number;
}

export const useActivateSpacesMutationsWeb3Rpc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();

  const {
    trigger: activateInSpaces,
    reset: resetActivateMutation,
    isMutating: isActivating,
    data: activateHash,
    error: activateError,
  } = useSWRMutation(
    `activateSpaces-${proposalSlug}`,
    async (_, { arg }: { arg: ActivateInSpacesInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const duration = await publicClient.readContract(
        getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
      );

      const transactions: z.infer<typeof transactionSchema>[] = [];

      const tokenAddress =
        arg.paymentToken === 'USDC'
          ? (USDC_TOKEN?.address as `0x${string}`)
          : (hyphaTokenAddress[chainId] as `0x${string}`);
      const decimals = await getTokenDecimals(tokenAddress);
      const parsedAmounts = arg.amounts.map((a) =>
        parseUnits(a.toString(), decimals ?? 6),
      );

      if (arg.paymentToken === 'USDC') {
        transactions.push({
          target: USDC_TOKEN?.address as `0x${string}`,
          value: 0,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [
              hyphaTokenAddress[chainId] as `0x${string}`,
              parsedAmounts.reduce((acc, val) => acc + val, 0n),
            ],
          }),
        });
      }

      const functionName =
        arg.paymentToken === 'USDC' ? 'payForSpaces' : 'payInHypha';

      transactions.push({
        target: hyphaTokenAddress[chainId] as `0x${string}`,
        value: 0,
        data: encodeFunctionData({
          abi: hyphaTokenAbi,
          functionName,
          args: [arg.spaceIds.map(BigInt), parsedAmounts],
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
    data: activationData,
    isLoading: isLoadingActivationFromTx,
    error: errorWaitActivationFromTx,
  } = useSWR(
    activateHash ? [activateHash, 'waitFor'] : null,
    async ([hash]) => {
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(receipt.logs);
    },
  );

  return {
    activateInSpaces,
    resetActivateMutation,
    isActivating,
    activateHash,
    activationData,
    isLoadingActivationFromTx,
    errorWaitActivationFromTx,
    activateError,
  };
};
