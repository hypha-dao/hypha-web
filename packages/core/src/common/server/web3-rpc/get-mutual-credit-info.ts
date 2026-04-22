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
  /**
   * Per-account effective credit limit (default + any override). Returns 0 when the
   * caller is not eligible (not member of any whitelisted space).
   */
  creditLimit: number;
  /**
   * Remaining credit available right now, in human units. Equals
   * `max(0, creditLimit - creditBalance)` for eligible accounts; 0 otherwise.
   */
  creditLimitLeft: number;
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
        { ...contract, functionName: 'creditLimitOf', args: [ownerAddress] },
        {
          ...contract,
          functionName: 'creditLimitLeftOf',
          args: [ownerAddress],
        },
      ],
    });

    const [
      defaultLimitResult,
      creditBalanceResult,
      netBalanceResult,
      whitelistResult,
      creditLimitResult,
      creditLimitLeftResult,
    ] = results;

    /** When all credit calls fail the contract isn't a RegularSpaceToken — skip. */
    const allFailed = results.every((r) => r.status === 'failure');
    if (allFailed) {
      return null;
    }

    /**
     * Partial multicall failures can silently corrupt reported balances (a transient
     * RPC error on one call surfaces as "0"). Surface them so the symptom is visible
     * in logs even though we still return the safe-fallback shape below.
     */
    const callNames = [
      'defaultCreditLimit',
      'creditBalanceOf',
      'netBalanceOf',
      'getCreditWhitelistedSpaces',
      'creditLimitOf',
      'creditLimitLeftOf',
    ] as const;
    const failed = results
      .map((r, i) => ({ name: callNames[i], status: r.status }))
      .filter((r) => r.status === 'failure');
    if (failed.length > 0) {
      console.warn(
        `getMutualCreditInfo: partial multicall failure for token ${tokenAddress} owner ${ownerAddress}: ${failed
          .map((f) => f.name)
          .join(', ')}`,
      );
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
    /**
     * `creditLimitOf` / `creditLimitLeftOf` already account for eligibility (returns 0
     * for non-whitelisted accounts) and any per-account override on top of the default.
     */
    const creditLimit =
      creditLimitResult?.status === 'success'
        ? Number(formatUnits(creditLimitResult.result as bigint, DECIMALS))
        : 0;
    /**
     * Only fall back to arithmetic when both inputs (creditLimit and creditBalance)
     * actually succeeded — otherwise we could report the full limit as available even
     * when the holder already has unreported debt.
     */
    const canDeriveCreditLimitLeft =
      creditLimitResult?.status === 'success' &&
      creditBalanceResult.status === 'success';
    const creditLimitLeft =
      creditLimitLeftResult?.status === 'success'
        ? Number(formatUnits(creditLimitLeftResult.result as bigint, DECIMALS))
        : canDeriveCreditLimitLeft
        ? Math.max(0, creditLimit - creditBalance)
        : 0;

    const isCreditEnabled =
      defaultCreditLimit > 0 || whitelistedSpaceIds.length > 0;

    return {
      defaultCreditLimit,
      creditBalance,
      netBalance,
      creditLimit,
      creditLimitLeft,
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
