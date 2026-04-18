'use client';

import useSWRMutation from 'swr/mutation';
import useSWR from 'swr';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import { encodeFunctionData, erc20Abi, parseUnits } from 'viem';
import { useParams } from 'next/navigation';

import { getProposalFromLogs } from '../web3';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
  decayingSpaceTokenAbi,
} from '@hypha-platform/core/generated';
import {
  getTokenDecimals,
  getSpaceMinProposalDuration,
  getSpaceDetails,
  publicClient,
  useSpaceBySlug,
} from '@hypha-platform/core/client';
import { getDuration } from '@hypha-platform/ui-utils';
import { getGovernanceChainId } from './governance-chain-id';
import {
  escrowImplementationAbi,
  getEscrowImplementationAddress,
} from '../escrow';

export interface ExchangeStakesAndTokensWeb3Input {
  spaceId: number;
  /** Seller wallet or space contract address as chosen in the form. */
  sellerAddress: `0x${string}`;
  /** Buyer wallet or space contract address as chosen in the form. */
  buyerAddress: `0x${string}`;
  /** Resolved on-chain party A: executor when seller is a space, else seller wallet. */
  sellerPartyAForEscrow: `0x${string}`;
  /** Resolved on-chain party B: executor when buyer is a space, else buyer wallet. */
  buyerPartyBForEscrow: `0x${string}`;
  /** What the seller deposits (tokenA / amountA). Single leg — contract supports one swap. */
  sellerLeg: { token: `0x${string}`; amount: string }[];
  /** What the buyer deposits (tokenB / amountB). */
  buyerLeg: { token: `0x${string}`; amount: string }[];
  sellerRecipientType?: 'member' | 'space';
  buyerRecipientType?: 'member' | 'space';
}

const chainId = getGovernanceChainId();

export const useExchangeStakesAndTokensMutationsWeb3Rpc = ({
  proposalSlug,
}: {
  proposalSlug?: string | null;
}) => {
  const { client } = useSmartWallets();
  const { id: activeSpaceSlug } = useParams();
  const { space: activeSpace } = useSpaceBySlug(
    (activeSpaceSlug as string) || '',
  );

  const {
    trigger: createExchangeStakesAndTokens,
    reset: resetCreateExchangeStakesAndTokensMutation,
    isMutating: isCreatingExchangeStakesAndTokens,
    data: createExchangeStakesAndTokensHash,
    error: errorCreateExchangeStakesAndTokens,
  } = useSWRMutation(
    `createExchangeStakesAndTokens-${proposalSlug}`,
    async (_, { arg }: { arg: ExchangeStakesAndTokensWeb3Input }) => {
      if (!client) {
        throw new Error('Smart wallet client not available');
      }

      const escrowAddress = getEscrowImplementationAddress();
      if (!escrowAddress) {
        throw new Error('HYPHA_ESCROW_ADDRESS_MISSING');
      }

      const sellerLeg = arg.sellerLeg[0];
      const buyerLeg = arg.buyerLeg[0];
      if (!sellerLeg || !buyerLeg) {
        throw new Error('Exchange legs are incomplete');
      }

      const [duration, spaceDetails] = await Promise.all([
        publicClient.readContract(
          getSpaceMinProposalDuration({ spaceId: BigInt(arg.spaceId) }),
        ),
        publicClient.readContract(
          getSpaceDetails({ spaceId: BigInt(arg.spaceId) }),
        ),
      ]);
      const executor = spaceDetails[9] as `0x${string}`;

      // "Is space" here means "is THIS proposing space" — i.e. the party whose
      // leg will be funded by the executor running these batched transactions.
      // For space↔space exchanges the counterparty space funds its side later
      // via its own proposal, triggered from the space-page deposit banner.
      const sellerIsSpace =
        arg.sellerPartyAForEscrow.toLowerCase() === executor.toLowerCase();
      const buyerIsSpace =
        arg.buyerPartyBForEscrow.toLowerCase() === executor.toLowerCase();

      const [decimalsA, decimalsB] = await Promise.all([
        getTokenDecimals(sellerLeg.token),
        getTokenDecimals(buyerLeg.token),
      ]);
      const amountA = parseUnits(sellerLeg.amount, decimalsA);
      const amountB = parseUnits(buyerLeg.amount, decimalsB);

      // viem's `parseUnits` silently rounds tiny fractional inputs down to 0n
      // when the entered fraction has more digits than the token supports
      // (e.g. `parseUnits('0.001', 2) === 0n`). Catch this client-side so
      // the user gets a meaningful error instead of an opaque on-chain
      // "Amount … must be greater than 0" revert from `createEscrow`.
      if (amountA === 0n) {
        throw new Error(
          `Seller amount "${sellerLeg.amount}" rounds to 0 for tokens with ${decimalsA} decimals — please increase it.`,
        );
      }
      if (amountB === 0n) {
        throw new Error(
          `Buyer amount "${buyerLeg.amount}" rounds to 0 for tokens with ${decimalsB} decimals — please increase it.`,
        );
      }

      const transactions: {
        target: `0x${string}`;
        value: bigint;
        data: `0x${string}`;
      }[] = [];

      // The space side (if any) is funded atomically inside createEscrow via
      // `_sendFundsNow=true`. The counterparty (always a member in Cases A/B, both
      // members in Case C) funds later via the deposit banner on their profile.
      const spaceFundsNow = sellerIsSpace || buyerIsSpace;

      if (spaceFundsNow) {
        const tokenToFund = sellerIsSpace ? sellerLeg.token : buyerLeg.token;
        const amountToFund = sellerIsSpace ? amountA : amountB;

        // Treasury pulls use the space's on-chain treasury address when known.
        // Missing sync (DB or new space): skip pull and attempt to mint the full
        // amount — proposal executor will revert if neither path covers it.
        const treasuryAddress = activeSpace?.address as
          | `0x${string}`
          | undefined;

        let pullFromTreasury = 0n;
        let mintShortfall = amountToFund;

        if (treasuryAddress) {
          const treasuryBalance = await publicClient.readContract({
            address: tokenToFund,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [treasuryAddress],
          });
          pullFromTreasury =
            treasuryBalance >= amountToFund ? amountToFund : treasuryBalance;
          mintShortfall = amountToFund - pullFromTreasury;
        }

        if (pullFromTreasury > 0n && treasuryAddress) {
          transactions.push({
            target: tokenToFund,
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
            target: tokenToFund,
            value: 0n,
            data: encodeFunctionData({
              abi: decayingSpaceTokenAbi,
              functionName: 'mint',
              args: [executor, mintShortfall],
            }),
          });
        }

        // Reset allowance to 0 first to support tokens that block
        // non-zero → non-zero updates (e.g. USDT). Safe no-op for tokens that
        // allow direct updates.
        transactions.push({
          target: tokenToFund,
          value: 0n,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [escrowAddress, 0n],
          }),
        });
        transactions.push({
          target: tokenToFund,
          value: 0n,
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'approve',
            args: [escrowAddress, amountToFund],
          }),
        });
      }

      transactions.push({
        target: escrowAddress,
        value: 0n,
        data: encodeFunctionData({
          abi: escrowImplementationAbi,
          functionName: 'createEscrow',
          args: [
            arg.sellerPartyAForEscrow,
            arg.buyerPartyBForEscrow,
            sellerLeg.token,
            buyerLeg.token,
            amountA,
            amountB,
            spaceFundsNow,
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
    data: createdExchangeStakesAndTokens,
    isLoading: isLoadingExchangeStakesAndTokensFromTransaction,
    error: errorWaitExchangeStakesAndTokensFromTransaction,
  } = useSWR(
    createExchangeStakesAndTokensHash
      ? [createExchangeStakesAndTokensHash, 'waitForExchangeStakesAndTokens']
      : null,
    async ([hash]) => {
      const { logs } = await publicClient.waitForTransactionReceipt({ hash });
      return getProposalFromLogs(logs);
    },
  );

  return {
    createExchangeStakesAndTokens,
    resetCreateExchangeStakesAndTokensMutation,
    isCreatingExchangeStakesAndTokens,
    createExchangeStakesAndTokensHash,
    errorCreateExchangeStakesAndTokens,
    isLoadingExchangeStakesAndTokensFromTransaction,
    errorWaitExchangeStakesAndTokensFromTransaction,
    createdExchangeStakesAndTokens,
  };
};
