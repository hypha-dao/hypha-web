'use client';

import useSWR from 'swr';
import { erc20Abi } from 'viem';
import { publicClient } from '@hypha-platform/core/client';
import {
  escrowImplementationAbi,
  getEscrowImplementationAddress,
} from '../escrow';

const MAX_ESCROWS_SCAN = 500;

export type RefundableEscrow = {
  escrowId: bigint;
  side: 'A' | 'B';
  partyA: `0x${string}`;
  partyB: `0x${string}`;
  /** Token the user already deposited and can refund. */
  refundToken: `0x${string}`;
  /** Amount the user already deposited (raw token units). */
  refundAmount: bigint;
  refundTokenSymbol: string;
  refundTokenDecimals: number;
  /** Token the counterparty owes (informational). */
  counterpartyToken: `0x${string}`;
  counterpartyAmount: bigint;
  /** True when the OPPOSITE party has also funded — refunding now also undoes their deposit. */
  isCounterpartyFunded: boolean;
};

type RawEscrow = readonly [
  `0x${string}`, // creator
  `0x${string}`, // partyA
  `0x${string}`, // partyB
  `0x${string}`, // tokenA
  `0x${string}`, // tokenB
  bigint, // amountA
  bigint, // amountB
  boolean, // isPartyAFunded
  boolean, // isPartyBFunded
  boolean, // isCompleted
  boolean, // isCancelled
];

/**
 * Returns escrows where `user` has already funded their side but the
 * escrow is still open (not completed, not cancelled). These can be
 * refunded by calling `cancelEscrow` followed by `withdrawFromCancelled`.
 *
 * Mirrors the structure of `usePendingEscrowDeposits` but with the
 * funding flag inverted so callers don't need to merge two lists.
 */
export const useRefundableEscrows = ({
  user,
}: {
  user?: `0x${string}` | null;
}) => {
  const escrowAddress = getEscrowImplementationAddress();

  const { data, isLoading, error, mutate } = useSWR(
    user && escrowAddress
      ? [user.toLowerCase(), escrowAddress, 'refundableEscrows']
      : null,
    async ([userKey, escrow]) => {
      const userAddress = userKey as `0x${string}`;
      const escrowContract = escrow as `0x${string}`;

      const counter = (await publicClient.readContract({
        address: escrowContract,
        abi: escrowImplementationAbi,
        functionName: 'escrowCounter',
      })) as bigint;

      if (counter === 0n) return [] as RefundableEscrow[];

      const total = Number(counter);
      const scanCount = Math.min(total, MAX_ESCROWS_SCAN);
      const ids: bigint[] = Array.from({ length: scanCount }, (_, i) =>
        BigInt(total - i),
      );

      const escrowReads = await publicClient.multicall({
        allowFailure: true,
        blockTag: 'latest',
        contracts: ids.map((id) => ({
          address: escrowContract,
          abi: escrowImplementationAbi,
          functionName: 'getEscrow' as const,
          args: [id] as const,
        })),
      });

      type Candidate = { escrowId: bigint; raw: RawEscrow; side: 'A' | 'B' };
      const candidates: Candidate[] = [];
      ids.forEach((id, idx) => {
        const res = escrowReads[idx];
        if (!res || res.status !== 'success' || !res.result) return;
        const raw = res.result as unknown as RawEscrow;
        const [
          ,
          partyA,
          partyB,
          ,
          ,
          ,
          ,
          isPartyAFunded,
          isPartyBFunded,
          isCompleted,
          isCancelled,
        ] = raw;
        if (isCompleted || isCancelled) return;
        const userLc = userAddress.toLowerCase();
        if (partyA.toLowerCase() === userLc && isPartyAFunded) {
          candidates.push({ escrowId: id, raw, side: 'A' });
          return;
        }
        if (partyB.toLowerCase() === userLc && isPartyBFunded) {
          candidates.push({ escrowId: id, raw, side: 'B' });
        }
      });

      if (candidates.length === 0) return [] as RefundableEscrow[];

      const tokenAddresses = new Set<`0x${string}`>();
      for (const { raw } of candidates) {
        tokenAddresses.add(raw[3]);
        tokenAddresses.add(raw[4]);
      }
      const tokenList = Array.from(tokenAddresses);

      const tokenMetaReads = await publicClient.multicall({
        allowFailure: true,
        blockTag: 'latest',
        contracts: tokenList.flatMap((address) => [
          {
            address,
            abi: erc20Abi,
            functionName: 'symbol' as const,
          },
          {
            address,
            abi: erc20Abi,
            functionName: 'decimals' as const,
          },
        ]),
      });
      const tokenMeta = new Map<
        `0x${string}`,
        { symbol: string; decimals: number }
      >();
      tokenList.forEach((address, i) => {
        const symbolRes = tokenMetaReads[i * 2];
        const decimalsRes = tokenMetaReads[i * 2 + 1];
        tokenMeta.set(address, {
          symbol:
            symbolRes?.status === 'success' ? (symbolRes.result as string) : '',
          decimals:
            decimalsRes?.status === 'success'
              ? Number(decimalsRes.result as number)
              : 18,
        });
      });

      return candidates.map<RefundableEscrow>(({ escrowId, raw, side }) => {
        const [
          ,
          partyA,
          partyB,
          tokenA,
          tokenB,
          amountA,
          amountB,
          isPartyAFunded,
          isPartyBFunded,
        ] = raw;
        const refundToken = side === 'A' ? tokenA : tokenB;
        const refundAmount = side === 'A' ? amountA : amountB;
        const counterpartyToken = side === 'A' ? tokenB : tokenA;
        const counterpartyAmount = side === 'A' ? amountB : amountA;
        const isCounterpartyFunded =
          side === 'A' ? isPartyBFunded : isPartyAFunded;
        const refundMeta = tokenMeta.get(refundToken);
        return {
          escrowId,
          side,
          partyA,
          partyB,
          refundToken,
          refundAmount,
          refundTokenSymbol: refundMeta?.symbol ?? '',
          refundTokenDecimals: refundMeta?.decimals ?? 18,
          counterpartyToken,
          counterpartyAmount,
          isCounterpartyFunded,
        };
      });
    },
    {
      revalidateOnFocus: true,
      refreshInterval: 30000,
    },
  );

  return {
    refundableEscrows: data ?? [],
    isLoading,
    error,
    refresh: mutate,
  };
};
