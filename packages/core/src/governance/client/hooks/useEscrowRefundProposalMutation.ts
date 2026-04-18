'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { encodeFunctionData } from 'viem';

import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '@hypha-platform/core/generated';
import {
  getSpaceMinProposalDuration,
  publicClient,
} from '@hypha-platform/core/client';
import { getDuration } from '@hypha-platform/ui-utils';

import { getProposalFromLogs } from '../web3';
import { getGovernanceChainId } from './governance-chain-id';
import {
  escrowImplementationAbi,
  getEscrowImplementationAddress,
} from '../escrow';

export interface EscrowRefundProposalInput {
  /** Web3 space ID of the space whose executor is the escrow party. */
  spaceId: number;
  /** On-chain escrow id to cancel and (optionally) withdraw from. */
  escrowId: bigint;
  /**
   * When true, also append `withdrawFromCancelled` so the executor's
   * already-deposited funds are returned in the same proposal execution.
   * The caller must have verified that the executor side is funded —
   * `withdrawFromCancelled` reverts otherwise.
   */
  withdrawAfterCancel?: boolean;
}

const chainId = getGovernanceChainId();

/**
 * Creates a governance proposal that, when executed by the space executor,
 * cancels an escrow the executor is a party to and (optionally) withdraws
 * the executor's deposit back to the treasury.
 *
 * Used by the treasury "Refund" action: the escrow contract only allows
 * the creator / partyA / partyB to cancel, so a personal smart-wallet call
 * from a member would revert with "Not authorized". Routing through a
 * proposal lets the executor make the call once approved, matching how
 * the deposit was originally created via
 * `useSpaceExchangeDepositProposalMutation`.
 */
export const useEscrowRefundProposalMutation = () => {
  const { client } = useSmartWallets();

  const {
    trigger: createRefundProposal,
    reset: resetRefundProposal,
    isMutating: isCreatingRefundProposal,
    data: refundProposalHash,
    error: refundProposalError,
  } = useSWRMutation(
    'escrowRefundProposal',
    async (_, { arg }: { arg: EscrowRefundProposalInput }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }
      const escrowAddress = getEscrowImplementationAddress();
      if (!escrowAddress) {
        throw new Error('HYPHA_ESCROW_ADDRESS_MISSING');
      }

      const [duration] = await Promise.all([
        publicClient.readContract(
          getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
        ),
      ]);

      const transactions: {
        target: `0x${string}`;
        value: bigint;
        data: `0x${string}`;
      }[] = [
        {
          target: escrowAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: escrowImplementationAbi,
            functionName: 'cancelEscrow',
            args: [arg.escrowId],
          }),
        },
      ];

      if (arg.withdrawAfterCancel) {
        transactions.push({
          target: escrowAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: escrowImplementationAbi,
            functionName: 'withdrawFromCancelled',
            args: [arg.escrowId],
          }),
        });
      }

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
    data: createdRefundProposal,
    isLoading: isLoadingCreatedRefundProposal,
    error: errorCreatedRefundProposal,
  } = useSWR(
    refundProposalHash
      ? [refundProposalHash, 'waitForEscrowRefundProposal']
      : null,
    async ([hash]) => {
      const { logs } = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(logs);
    },
  );

  return {
    createRefundProposal,
    resetRefundProposal,
    isCreatingRefundProposal,
    refundProposalHash,
    refundProposalError,
    createdRefundProposal,
    isLoadingCreatedRefundProposal,
    errorCreatedRefundProposal,
  };
};
