'use client';

import useSWR from 'swr';
import { erc20Abi } from 'viem';
import { publicClient } from '@hypha-platform/core/client';
import {
  escrowImplementationAbi,
  getEscrowImplementationAddress,
} from '../escrow';

/** Cap on how many escrows we iterate from 1..counter. Protects against runaway gas/RPC. */
const MAX_ESCROWS_SCAN = 500;

export type PendingEscrowDeposit = {
  escrowId: bigint;
  /** Party A (space executor) — funds tokenA into escrow and receives tokenB. */
  partyA: `0x${string}`;
  /** Party B (investor = current user) — funds tokenB into escrow and receives tokenA. */
  partyB: `0x${string}`;
  /** Token the space deposits (what the investor receives on completion). */
  tokenA: `0x${string}`;
  /** Token the investor must deposit. */
  tokenB: `0x${string}`;
  amountA: bigint;
  amountB: bigint;
  isPartyAFunded: boolean;
  /** Symbol/decimals for tokenB (what the user pays in). */
  tokenBSymbol: string;
  tokenBDecimals: number;
  /** Symbol/decimals for tokenA (what the user will receive). */
  tokenASymbol: string;
  tokenADecimals: number;
  /** Current ERC20 allowance granted to the escrow contract by the user for tokenB. */
  allowanceB: bigint;
  /** User's tokenB balance — used to decide whether the deposit button should be enabled. */
  balanceB: bigint;
};

type RawEscrow = readonly [
  `0x${string}`,
  `0x${string}`,
  `0x${string}`,
  `0x${string}`,
  `0x${string}`,
  bigint,
  bigint,
  boolean,
  boolean,
  boolean,
  boolean,
];

export const usePendingEscrowDeposits = ({
  user,
}: {
  user?: `0x${string}`;
}) => {
  const escrowAddress = getEscrowImplementationAddress();

  const { data, isLoading, error, mutate } = useSWR(
    user && escrowAddress
      ? [user.toLowerCase(), escrowAddress, 'pendingEscrowDeposits']
      : null,
    async ([userKey, escrow]) => {
      const userAddress = userKey as `0x${string}`;
      const escrowContract = escrow as `0x${string}`;

      const counter = (await publicClient.readContract({
        address: escrowContract,
        abi: escrowImplementationAbi,
        functionName: 'escrowCounter',
      })) as bigint;

      if (counter === 0n) return [] as PendingEscrowDeposit[];

      const total = Number(counter);
      const scanCount = Math.min(total, MAX_ESCROWS_SCAN);
      // Scan most recent first so newest pending escrows surface quickly.
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

      const candidates: {
        escrowId: bigint;
        raw: RawEscrow;
      }[] = [];
      ids.forEach((id, idx) => {
        const res = escrowReads[idx];
        if (!res || res.status !== 'success' || !res.result) return;
        const raw = res.result as unknown as RawEscrow;
        const [, , partyB, , , , , , isPartyBFunded, isCompleted, isCancelled] =
          raw;
        if (partyB.toLowerCase() !== userAddress.toLowerCase()) return;
        if (isPartyBFunded || isCompleted || isCancelled) return;
        candidates.push({ escrowId: id, raw });
      });

      if (candidates.length === 0) return [] as PendingEscrowDeposit[];

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

      const allowanceBalanceReads = await publicClient.multicall({
        allowFailure: true,
        blockTag: 'latest',
        contracts: candidates.flatMap(({ raw }) => [
          {
            address: raw[4],
            abi: erc20Abi,
            functionName: 'allowance' as const,
            args: [userAddress, escrowContract] as const,
          },
          {
            address: raw[4],
            abi: erc20Abi,
            functionName: 'balanceOf' as const,
            args: [userAddress] as const,
          },
        ]),
      });

      return candidates.map<PendingEscrowDeposit>(({ escrowId, raw }, idx) => {
        const [
          ,
          partyA,
          partyB,
          tokenA,
          tokenB,
          amountA,
          amountB,
          isPartyAFunded,
        ] = raw;
        const allowanceRes = allowanceBalanceReads[idx * 2];
        const balanceRes = allowanceBalanceReads[idx * 2 + 1];
        const metaA = tokenMeta.get(tokenA);
        const metaB = tokenMeta.get(tokenB);
        return {
          escrowId,
          partyA,
          partyB,
          tokenA,
          tokenB,
          amountA,
          amountB,
          isPartyAFunded,
          tokenASymbol: metaA?.symbol ?? '',
          tokenADecimals: metaA?.decimals ?? 18,
          tokenBSymbol: metaB?.symbol ?? '',
          tokenBDecimals: metaB?.decimals ?? 18,
          allowanceB:
            allowanceRes?.status === 'success'
              ? (allowanceRes.result as bigint)
              : 0n,
          balanceB:
            balanceRes?.status === 'success'
              ? (balanceRes.result as bigint)
              : 0n,
        };
      });
    },
    {
      revalidateOnFocus: true,
      refreshInterval: 30000,
    },
  );

  return {
    pendingDeposits: data ?? [],
    isLoading,
    error,
    refresh: mutate,
  };
};
