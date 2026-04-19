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
  /** What the investor pays into escrow (tokenB / amountB). Single leg — contract supports one swap. */
  investorSendLegs: { token: `0x${string}`; amount: string }[];
  /** What the space pays into escrow (tokenA / amountA); investor receives on completion. */
  spaceReceiveLegs: { token: `0x${string}`; amount: string }[];
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

      // Validate array lengths early
      if (arg.investorSendLegs.length !== 1) {
        throw new Error(
          `Investment requires exactly one investor send leg, received ${arg.investorSendLegs.length}`,
        );
      }
      if (arg.spaceReceiveLegs.length !== 1) {
        throw new Error(
          `Investment requires exactly one space receive leg, received ${arg.spaceReceiveLegs.length}`,
        );
      }

      const escrowAddress = getEscrowImplementationAddress();
      if (!escrowAddress) {
        throw new Error('HYPHA_ESCROW_ADDRESS_MISSING');
      }

      const duration = await publicClient.readContract(
        getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
      );

      const spaceDetails = await publicClient.readContract(
        getSpaceDetails({ spaceId: BigInt(arg.spaceId) }),
      );
      const executor = spaceDetails[9] as `0x${string}`;

      const investorSend = arg.investorSendLegs[0];
      const spaceReceive = arg.spaceReceiveLegs[0];
      if (!investorSend || !spaceReceive) {
        throw new Error('Investment legs are incomplete');
      }

      const transactions: {
        target: `0x${string}`;
        value: bigint;
        data: `0x${string}`;
      }[] = [];

      // Treasury pull uses the space's on-chain treasury address when known.
      // If missing (e.g. DB not synced), skip pull and mint the full amount — any
      // member/delegate may sign createProposal; executor-only actions run at execution.
      const treasuryAddress = space?.address as `0x${string}` | undefined;

      const decimalsA = await getTokenDecimals(spaceReceive.token);
      const decimalsB = await getTokenDecimals(investorSend.token);
      const amountA = parseUnits(spaceReceive.amount, decimalsA);
      const amountB = parseUnits(investorSend.amount, decimalsB);

      // In current Hypha deployments `space.address === executor`, so a
      // `transferFrom(treasury, executor, …)` would be a self-to-self call
      // that reverts at execution time (allowance(executor, executor) == 0).
      // When the treasury IS the executor, skip the pull and read the
      // executor's own balance to size the mint shortfall — the executor
      // already holds the funds (or we mint the difference). Without this
      // guard, an investment proposal whose receive-token sits in the
      // executor's own wallet contains a doomed `transferFrom(executor,
      // executor, X)`; the first vote that pushes thresholds over the line
      // auto-executes → ERC20InsufficientAllowance → the voter's tx reverts
      // and the proposal stays stuck in "On Voting" forever (see the FFFF
      // exchange-tokens fix in `useExchangeStakesAndTokensMutations`).
      const isSelfTreasury =
        !!treasuryAddress &&
        treasuryAddress.toLowerCase() === executor.toLowerCase();

      let pullFromTreasury = 0n;
      let mintShortfall = amountA;

      if (isSelfTreasury) {
        const executorBalance = await publicClient.readContract({
          address: spaceReceive.token,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [executor],
        });
        mintShortfall =
          executorBalance >= amountA ? 0n : amountA - executorBalance;
      } else if (treasuryAddress) {
        const treasuryBalance = await publicClient.readContract({
          address: spaceReceive.token,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [treasuryAddress],
        });
        pullFromTreasury =
          treasuryBalance >= amountA ? amountA : treasuryBalance;
        mintShortfall = amountA - pullFromTreasury;
      }

      if (pullFromTreasury > 0n && treasuryAddress && !isSelfTreasury) {
        transactions.push({
          target: spaceReceive.token,
          value: 0n,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transferFrom',
            args: [treasuryAddress, executor, pullFromTreasury],
          }),
        });
      }

      if (mintShortfall > 0n) {
        transactions.push({
          target: spaceReceive.token,
          value: 0n,
          data: encodeFunctionData({
            abi: decayingSpaceTokenAbi,
            functionName: 'mint',
            args: [executor, mintShortfall],
          }),
        });
      }

      transactions.push({
        target: spaceReceive.token,
        value: 0n,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [escrowAddress, 0n],
        }),
      });
      transactions.push({
        target: spaceReceive.token,
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
            executor,
            arg.investorAddress,
            spaceReceive.token,
            investorSend.token,
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