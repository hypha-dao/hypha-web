'use server';

import { formatUnits } from 'viem';
import { web3Client } from './client';
import { decayingSpaceTokenAbi } from '../../../generated';

const DECIMALS = 18;

export type MutualCreditInfo = {
  /** Default credit limit for eligible accounts, in human units (1e18 stripped). */
  defaultCreditLimit: number;
  /** Outstanding debt for the account, in human units. Always >= 0. */
  creditBalance: number;
  /** Net position (token balance − credit debt), in human units. Negative = in debt. */
  netBalance: number;
  /** Whether mutual credit is configured (limit > 0 or whitelisted spaces > 0). */
  isCreditEnabled: boolean;
  /** Web3 ids of credit-whitelisted spaces. */
  whitelistedSpaceIds: number[];
};

/**
 * Reads mutual credit fields from a `RegularSpaceToken`. Returns `null` if the contract
 * doesn't expose these functions (e.g. ownership / voice tokens deployed by other
 * factories). Designed to never throw — falls back to nulls on RPC failure.
 */
export async function getMutualCreditInfo(
  tokenAddress: `0x${string}`,
  ownerAddress: `0x${string}`,
): Promise<MutualCreditInfo | null> {
  const contract = {
    abi: decayingSpaceTokenAbi,
    address: tokenAddress,
  } as const;

  try {
    const results = await web3Client.multicall({
      allowFailure: true,
      blockTag: 'safe',
      contracts: [
        { ...contract, functionName: 'defaultCreditLimit', args: [] },
        { ...contract, functionName: 'creditBalanceOf', args: [ownerAddress] },
        { ...contract, functionName: 'netBalanceOf', args: [ownerAddress] },
        { ...contract, functionName: 'getCreditWhitelistedSpaces', args: [] },
      ],
    });

    const [
      defaultLimitResult,
      creditBalanceResult,
      netBalanceResult,
      whitelistResult,
    ] = results;

    /** When all credit calls fail the contract isn't a RegularSpaceToken — skip. */
    const allFailed = results.every((r) => r.status === 'failure');
    if (allFailed) {
      return null;
    }

    const defaultCreditLimit =
      defaultLimitResult.status === 'success'
        ? Number(formatUnits(defaultLimitResult.result as bigint, DECIMALS))
        : 0;
    const creditBalance =
      creditBalanceResult.status === 'success'
        ? Number(formatUnits(creditBalanceResult.result as bigint, DECIMALS))
        : 0;
    /**
     * `netBalanceOf` returns int256 — positive when balance > debt, negative when in debt.
     * `formatUnits` accepts negative bigints and preserves sign; bigint → Number is fine
     * for human-scale token amounts displayed in the UI.
     */
    const netBalance =
      netBalanceResult.status === 'success'
        ? Number(formatUnits(netBalanceResult.result as bigint, DECIMALS))
        : 0;
    const whitelistedSpaceIds =
      whitelistResult.status === 'success'
        ? (whitelistResult.result as readonly bigint[]).map((id) => Number(id))
        : [];

    const isCreditEnabled =
      defaultCreditLimit > 0 || whitelistedSpaceIds.length > 0;

    return {
      defaultCreditLimit,
      creditBalance,
      netBalance,
      isCreditEnabled,
      whitelistedSpaceIds,
    };
  } catch (err) {
    console.warn(
      `getMutualCreditInfo failed for token ${tokenAddress} owner ${ownerAddress}: ${err}`,
    );
    return null;
  }
}
