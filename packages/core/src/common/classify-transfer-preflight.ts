export type MutualCreditPreflight = {
  creditLimitLeft?: number;
  creditLimit?: number;
  creditEligible?: boolean;
  addressWhitelisted?: boolean;
};

export type TransferPreflightResult =
  | { status: 'ok' }
  | { status: 'insufficient_funds'; isHypha: boolean }
  | {
      status: 'credit_limit';
      symbol: string;
      balance: number;
      creditLeft: number;
      creditLimit: number;
      spendable: number;
    }
  | {
      status: 'not_credit_eligible';
      symbol: string;
      balance: number;
    };

export function remainingCreditForTransfer(
  mutualCredit?: MutualCreditPreflight | null,
): number {
  return typeof mutualCredit?.creditLimitLeft === 'number'
    ? mutualCredit.creditLimitLeft
    : 0;
}

/**
 * Client-side spend check that mirrors RegularSpaceToken credit:
 * spendable = ERC-20 balance + remaining credit line.
 *
 * Do **not** gate remaining credit on a space-only `creditEligible` flag —
 * address-whitelisted accounts have a credit line even when they are not
 * members of a credit-whitelisted space.
 */
export function classifyTransferPreflight(input: {
  amount: number;
  balance: number;
  symbol?: string;
  mutualCredit?: MutualCreditPreflight | null;
}): TransferPreflightResult {
  const creditLeft = remainingCreditForTransfer(input.mutualCredit);
  const spendable = input.balance + creditLeft;
  if (input.amount <= spendable) {
    return { status: 'ok' };
  }

  const mc = input.mutualCredit;
  const hasCreditContext = Boolean(mc);
  const isEligible = Boolean(
    mc?.addressWhitelisted ||
      mc?.creditEligible ||
      (typeof mc?.creditLimit === 'number' && mc.creditLimit > 0),
  );

  if (hasCreditContext && isEligible) {
    return {
      status: 'credit_limit',
      symbol: input.symbol ?? '',
      balance: input.balance,
      creditLeft,
      creditLimit: typeof mc?.creditLimit === 'number' ? mc.creditLimit : 0,
      spendable,
    };
  }

  if (hasCreditContext && !isEligible) {
    return {
      status: 'not_credit_eligible',
      symbol: input.symbol ?? '',
      balance: input.balance,
    };
  }

  return {
    status: 'insufficient_funds',
    isHypha: input.symbol === 'HYPHA',
  };
}
