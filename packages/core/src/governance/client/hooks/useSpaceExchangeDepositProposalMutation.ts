'use client';

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { encodeFunctionData, erc20Abi } from 'viem';

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
  /**
   * The space's treasury / on-chain space contract address. When present and
   * holding the pay token, funds are pulled via `transferFrom(treasury → executor)`
   * before the approve/receiveFunds calls. When missing or short, a `mint(executor)`
   * call is added for any shortfall (only works for DecayingSpaceToken legs; reverts
   * otherwise at execution time — which is the desired behaviour).
   */
  treasuryAddress?: `0x${string}` | null;
  /** The space's executor address — target of `transferFrom`/`mint`. */
  executorAddress: `0x${string}`;
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

      const transactions: {
        target: `0x${string}`;
        value: bigint;
        data: `0x${string}`;
      }[] = [];

      let pullFromTreasury = 0n;
      let mintShortfall = arg.payAmount;

      if (arg.treasuryAddress) {
        try {
          const treasuryBalance = await publicClient.readContract({
            address: arg.payToken,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [arg.treasuryAddress],
          });
          pullFromTreasury =
            treasuryBalance >= arg.payAmount ? arg.payAmount : treasuryBalance;
          mintShortfall = arg.payAmount - pullFromTreasury;
        } catch {
          // if balance read fails, fall back to mint-only path
          pullFromTreasury = 0n;
          mintShortfall = arg.payAmount;
        }
      }

      if (pullFromTreasury > 0n && arg.treasuryAddress) {
        transactions.push({
          target: arg.payToken,
          value: 0n,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transferFrom',
            args: [arg.treasuryAddress, arg.executorAddress, pullFromTreasury],
          }),
        });
      }

      if (mintShortfall > 0n) {
        transactions.push({
          target: arg.payToken,
          value: 0n,
          data: encodeFunctionData({
            abi: decayingSpaceTokenAbi,
            functionName: 'mint',
            args: [arg.executorAddress, mintShortfall],
          }),
        });
      }

      // Reset-then-approve pattern for tokens that reject non-zero → non-zero
      // allowance changes (e.g. USDT-style ERC20s).
      transactions.push({
        target: arg.payToken,
        value: 0n,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [escrowAddress, 0n],
        }),
      });
      transactions.push({
        target: arg.payToken,
        value: 0n,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [escrowAddress, arg.payAmount],
        }),
      });

      transactions.push({
        target: escrowAddress,
        value: 0n,
        data: encodeFunctionData({
          abi: escrowImplementationAbi,
          functionName: 'receiveFunds',
          args: [arg.escrowId],
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
