'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { encodeFunctionData, erc20Abi } from 'viem';

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

export interface SpaceExchangeDepositProposalInput {
  /** Web3 space ID of the counterparty space that owes its leg. */
  spaceId: number;
  /** On-chain escrow id the proposal will settle. */
  escrowId: bigint;
  /** Token this space owes (raw address, already the "pay" side for this space). */
  payToken: `0x${string}`;
  /** Amount in raw token units (already scaled by payToken decimals). */
  payAmount: bigint;
  /** Proposal title (shown in the counterparty space's agreements tab). */
  title?: string;
  /** Proposal description (plain text / markdown). */
  description?: string;
}

const chainId = getGovernanceChainId();

/**
 * Creates a proposal inside the counterparty space that, when executed by the
 * space executor, approves the escrow and calls `receiveFunds(escrowId)` so
 * the exchange can complete.
 *
 * Used by the space-page escrow deposit banner for the space↔space exchange
 * flow — mirrors the seller-side funding logic of the original exchange
 * proposal, but scoped to a single leg.
 */
export const useSpaceExchangeDepositProposalMutation = () => {
  const { client } = useSmartWallets();

  const {
    trigger: createDepositProposal,
    reset: resetDepositProposal,
    isMutating: isCreatingDepositProposal,
    data: depositProposalHash,
    error: depositProposalError,
  } = useSWRMutation(
    'spaceExchangeDepositProposal',
    async (_, { arg }: { arg: SpaceExchangeDepositProposalInput }) => {
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

      /**
       * Minimal, correct tx set: approve the escrow and call `receiveFunds`.
       *
       * The space's executor IS the treasury in current Hypha deployments
       * (`space.address === executor`), so there is no separate treasury to
       * pull from — a `transferFrom(treasury, executor, …)` call would be a
       * self-to-self transferFrom that reverts during simulation.
       *
       * For space-issued tokens that support auto-minting (see
       * `RegularSpaceToken._autoMintIfNeeded`), the token mints any shortfall
       * automatically inside its own `transferFrom`, which the escrow invokes
       * from `receiveFunds`. For external tokens (USDC, DADA, etc.) a
       * shortfall reverts there with a clear "insufficient balance" error —
       * emitting a client-side `mint` call would just revert earlier with a
       * less informative error, so we omit it.
       */
      const transactions: {
        target: `0x${string}`;
        value: bigint;
        data: `0x${string}`;
      }[] = [
        // Reset-then-approve pattern for tokens that reject non-zero →
        // non-zero allowance changes (e.g. USDT-style ERC20s).
        {
          target: arg.payToken,
          value: 0n,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [escrowAddress, 0n],
          }),
        },
        {
          target: arg.payToken,
          value: 0n,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [escrowAddress, arg.payAmount],
          }),
        },
        {
          target: escrowAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: escrowImplementationAbi,
            functionName: 'receiveFunds',
            args: [arg.escrowId],
          }),
        },
      ];

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
    data: createdDepositProposal,
    isLoading: isLoadingCreatedDepositProposal,
    error: errorCreatedDepositProposal,
  } = useSWR(
    depositProposalHash
      ? [depositProposalHash, 'waitForSpaceExchangeDepositProposal']
      : null,
    async ([hash]) => {
      const { logs } = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(logs);
    },
  );

  return {
    createDepositProposal,
    resetDepositProposal,
    isCreatingDepositProposal,
    depositProposalHash,
    depositProposalError,
    createdDepositProposal,
    isLoadingCreatedDepositProposal,
    errorCreatedDepositProposal,
  };
};
