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
  /** Which side of the escrow the current user is on. */
  side: 'A' | 'B';
  /**
   * Address that called `createEscrow`. The proposer/seller in the
   * common flow where partyA pre-funds the offer; investment proposals
   * surface the issuing space as creator while the investor sits on side B.
   */
  creator: `0x${string}`;
  partyA: `0x${string}`;
  partyB: `0x${string}`;
  /** Raw escrow tokenA (always the A-side token regardless of user side). */
  tokenA: `0x${string}`;
  /** Raw escrow tokenB (always the B-side token regardless of user side). */
  tokenB: `0x${string}`;
  /** Raw escrow amountA. */
  amountA: bigint;
  /** Raw escrow amountB. */
  amountB: bigint;
  isPartyAFunded: boolean;
  isPartyBFunded: boolean;
  /**
   * @deprecated Kept for backward compatibility with existing consumers. When
   *   the user is on side B this mirrors `isPartyAFunded` (the counterparty).
   *   Prefer `isCounterpartyFunded`.
   */
  /** Funding flag for the OPPOSITE side (useful for messaging "they have already deposited"). */
  isCounterpartyFunded: boolean;
  /** Token the user must deposit to complete their side. */
  payToken: `0x${string}`;
  /** Amount the user must deposit (raw units scaled by payToken decimals). */
  payAmount: bigint;
  /** Token the user will receive when both sides are funded. */
  receiveToken: `0x${string}`;
  /** Amount the user will receive. */
  receiveAmount: bigint;
  payTokenSymbol: string;
  payTokenDecimals: number;
  receiveTokenSymbol: string;
  receiveTokenDecimals: number;
  /** ERC20 allowance for `payToken` granted by the user to the escrow contract. */
  payAllowance: bigint;
  /** User's current `payToken` balance. */
  payBalance: bigint;
  // ── Back-compat aliases (kept so existing UI that reads amountB/tokenB etc. keeps working) ──
  /** Back-compat: same as `payTokenDecimals`. */
  tokenBDecimals: number;
  /** Back-compat: same as `payTokenSymbol`. */
  tokenBSymbol: string;
  /** Back-compat: same as `receiveTokenDecimals`. */
  tokenADecimals: number;
  /** Back-compat: same as `receiveTokenSymbol`. */
  tokenASymbol: string;
  /** Back-compat: same as `payAllowance`. */
  allowanceB: bigint;
  /** Back-compat: same as `payBalance`. */
  balanceB: bigint;
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
          /* creator */ partyA,
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
        if (partyB.toLowerCase() === userLc && !isPartyBFunded) {
          candidates.push({ escrowId: id, raw, side: 'B' });
          return;
        }
        if (partyA.toLowerCase() === userLc && !isPartyAFunded) {
          candidates.push({ escrowId: id, raw, side: 'A' });
        }
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
        contracts: candidates.flatMap(({ raw, side }) => {
          const payToken = side === 'A' ? raw[3] : raw[4];
          return [
            {
              address: payToken,
              abi: erc20Abi,
              functionName: 'allowance' as const,
              args: [userAddress, escrowContract] as const,
            },
            {
              address: payToken,
              abi: erc20Abi,
              functionName: 'balanceOf' as const,
              args: [userAddress] as const,
            },
          ];
        }),
      });

      return candidates.map<PendingEscrowDeposit>(
        ({ escrowId, raw, side }, idx) => {
          const [
            creator,
            partyA,
            partyB,
            tokenA,
            tokenB,
            amountA,
            amountB,
            isPartyAFunded,
            isPartyBFunded,
          ] = raw;
          const allowanceRes = allowanceBalanceReads[idx * 2];
          const balanceRes = allowanceBalanceReads[idx * 2 + 1];
          const payToken = side === 'A' ? tokenA : tokenB;
          const payAmount = side === 'A' ? amountA : amountB;
          const receiveToken = side === 'A' ? tokenB : tokenA;
          const receiveAmount = side === 'A' ? amountB : amountA;
          const isCounterpartyFunded =
            side === 'A' ? isPartyBFunded : isPartyAFunded;
          const payMeta = tokenMeta.get(payToken);
          const receiveMeta = tokenMeta.get(receiveToken);
          const payAllowance =
            allowanceRes?.status === 'success'
              ? (allowanceRes.result as bigint)
              : 0n;
          const payBalance =
            balanceRes?.status === 'success'
              ? (balanceRes.result as bigint)
              : 0n;
          return {
            escrowId,
            side,
            creator,
            partyA,
            partyB,
            tokenA,
            tokenB,
            amountA,
            amountB,
            isPartyAFunded,
            isPartyBFunded,
            isCounterpartyFunded,
            payToken,
            payAmount,
            receiveToken,
            receiveAmount,
            payTokenSymbol: payMeta?.symbol ?? '',
            payTokenDecimals: payMeta?.decimals ?? 18,
            receiveTokenSymbol: receiveMeta?.symbol ?? '',
            receiveTokenDecimals: receiveMeta?.decimals ?? 18,
            payAllowance,
            payBalance,
            // back-compat
            tokenBSymbol: payMeta?.symbol ?? '',
            tokenBDecimals: payMeta?.decimals ?? 18,
            tokenASymbol: receiveMeta?.symbol ?? '',
            tokenADecimals: receiveMeta?.decimals ?? 18,
            allowanceB: payAllowance,
            balanceB: payBalance,
          };
        },
      );
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
