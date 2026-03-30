'use client';

import useSWRMutation from 'swr/mutation';
import useSWR from 'swr';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { encodeFunctionData, erc20Abi, parseUnits } from 'viem';

import { getProposalFromLogs } from '../web3';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
  decayingSpaceTokenAbi,
} from '@hypha-platform/core/generated';
import {
  getTokenDecimals,
  getSpaceMinProposalDuration,
  publicClient,
  getSpaceDetails,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { useParams } from 'next/navigation';
import { getDuration } from '@hypha-platform/ui-utils';
import { getGovernanceChainId } from './governance-chain-id';
import {
  escrowImplementationAbi,
  getEscrowImplementationAddress,
} from '../escrow';

export interface AcceptInvestmentWeb3Input {
  spaceId: number;
  investorAddress: `0x${string}`;
  /** What the investor pays into escrow (tokenB / amountB). */
  investorSend: { token: `0x${string}`; amount: string };
  /** What the space pays into escrow (tokenA / amountA); investor receives this on completion. */
  spaceReceive: {
    token: `0x${string}`;
    amount: string;
    source: 'mint' | 'treasury';
  };
}

const chainId = getGovernanceChainId();

export const useAcceptInvestmentMutationsWeb3Rpc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();
  const { id: spaceSlug } = useParams();
  const { space } = useSpaceBySlug((spaceSlug as string) || '');

  const {
    trigger: createAcceptInvestment,
    reset: resetCreateAcceptInvestmentMutation,
    isMutating: isCreatingAcceptInvestment,
    data: createAcceptInvestmentHash,
    error: errorCreateAcceptInvestment,
  } = useSWRMutation(
    `createAcceptInvestment-${proposalSlug}`,
    async (_, { arg }: { arg: AcceptInvestmentWeb3Input }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const escrowAddress = getEscrowImplementationAddress();
      if (!escrowAddress) {
        throw new Error(
          'Escrow contract is not configured (NEXT_PUBLIC_ESCROW_IMPLEMENTATION_ADDRESS).',
        );
      }

      const duration = await publicClient.readContract(
        getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
      );

      const spaceDetails = await publicClient.readContract(
        getSpaceDetails({ spaceId: BigInt(arg.spaceId) }),
      );
      const executor = spaceDetails[9] as `0x${string}`;

      const decimalsA = await getTokenDecimals(arg.spaceReceive.token);
      const decimalsB = await getTokenDecimals(arg.investorSend.token);
      const amountA = parseUnits(arg.spaceReceive.amount, decimalsA);
      const amountB = parseUnits(arg.investorSend.amount, decimalsB);

      const transactions: {
        target: `0x${string}`;
        value: bigint;
        data: `0x${string}`;
      }[] = [];

      if (arg.spaceReceive.source === 'mint') {
        transactions.push({
          target: arg.spaceReceive.token,
          value: 0n,
          data: encodeFunctionData({
            abi: decayingSpaceTokenAbi,
            functionName: 'mint',
            args: [executor, amountA],
          }),
        });
      } else {
        if (!space?.address) {
          throw new Error(
            'Space treasury address is unavailable; cannot pull tokens from treasury.',
          );
        }
        transactions.push({
          target: arg.spaceReceive.token,
          value: 0n,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transferFrom',
            args: [space.address as `0x${string}`, executor, amountA],
          }),
        });
      }

      transactions.push({
        target: arg.spaceReceive.token,
        value: 0n,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [escrowAddress, 0n],
        }),
      });
      transactions.push({
        target: arg.spaceReceive.token,
        value: 0n,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [escrowAddress, amountA],
        }),
      });

      transactions.push({
        target: escrowAddress,
        value: 0n,
        data: encodeFunctionData({
          abi: escrowImplementationAbi,
          functionName: 'createEscrow',
          args: [
            arg.investorAddress,
            arg.spaceReceive.token,
            arg.investorSend.token,
            amountA,
            amountB,
            true,
          ],
        }),
      });

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
    data: createdAcceptInvestment,
    isLoading: isLoadingAcceptInvestmentFromTransaction,
    error: errorWaitAcceptInvestmentFromTransaction,
  } = useSWR(
    createAcceptInvestmentHash
      ? [createAcceptInvestmentHash, 'waitForAcceptInvestment']
      : null,
    async ([hash]) => {
      const { logs } = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(logs);
    },
  );

  return {
    createAcceptInvestment,
    resetCreateAcceptInvestmentMutation,
    isCreatingAcceptInvestment,
    createAcceptInvestmentHash,
    errorCreateAcceptInvestment,
    isLoadingAcceptInvestmentFromTransaction,
    errorWaitAcceptInvestmentFromTransaction,
    createdAcceptInvestment,
  };
};
