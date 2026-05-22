import {
  BANK_CURRENCY_METAS,
  type BankCurrencyCode,
} from './bank-currency-display';
import type {
  BankCustomerPublicStatus,
  BankOperationLifecycle,
  BankTransferPublic,
  BankVirtualAccountPublic,
} from './hooks/types';

/** Keep in sync with `AssetsList` in treasury/components/assets/assets-list.tsx */
export const TREASURY_CARD_GRID_CLASS =
  'mt-2 grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4';

/** Empty list placeholder — use Hypha spacing tokens only (1–9); py-16 etc. are not defined. */
export const BANKING_EMPTY_STATE_CLASS =
  'my-4 flex min-h-[9rem] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background-2/50 px-5 py-7 text-center';

/** Loading placeholder — same vertical rhythm as empty state. */
export const BANKING_LOADING_STATE_CLASS =
  'my-4 flex min-h-[9rem] flex-col items-center justify-center gap-2 rounded-lg border border-border bg-background-2/50 px-5 py-7 text-center';

/** Bordered surface for copyable banking fields (cards + instruction blocks). */
export const BANKING_COPYABLE_SURFACE_CLASS =
  'rounded-md border border-border/70 bg-muted/25';

/** True while ToS/KYB still need action (matches gear procedure badges). */
export function isBankVerificationInProgress(
  status: BankCustomerPublicStatus | null | undefined,
): boolean {
  if (!status || status.isApproved || status.approvalRegistered) {
    return false;
  }
  return !status.procedures.tos.isComplete || !status.procedures.kyc.isComplete;
}

/** True when provider validations are done and pending ops can activate. */
export function isCustomerReadyForBankOperations(
  status: BankCustomerPublicStatus | null | undefined,
): boolean {
  if (!status) {
    return false;
  }
  if (status.isApproved || status.approvalRegistered) {
    return true;
  }
  return status.procedures.tos.isComplete && status.procedures.kyc.isComplete;
}

type BankOperationLike = {
  lifecycle: BankOperationLifecycle;
  canActivate: boolean;
  canContinueVerification: boolean;
  status: string;
};

function enrichBankOperationWithCustomerStatus<T extends BankOperationLike>(
  operation: T,
  status: BankCustomerPublicStatus | null | undefined,
): T {
  if (
    !isCustomerReadyForBankOperations(status) ||
    operation.lifecycle === 'active'
  ) {
    return operation;
  }

  if (
    operation.lifecycle === 'pending_kyb' ||
    operation.status === 'pending_kyb'
  ) {
    return {
      ...operation,
      lifecycle: 'pending_activation',
      canActivate: true,
      canContinueVerification: false,
    };
  }

  return operation;
}

export function enrichVirtualAccountWithCustomerStatus(
  account: BankVirtualAccountPublic,
  status: BankCustomerPublicStatus | null | undefined,
): BankVirtualAccountPublic {
  return enrichBankOperationWithCustomerStatus(account, status);
}

export function enrichTransferWithCustomerStatus(
  transfer: BankTransferPublic,
  status: BankCustomerPublicStatus | null | undefined,
): BankTransferPublic {
  return enrichBankOperationWithCustomerStatus(transfer, status);
}

export function getCoveredBankCurrencyCodes(
  virtualAccounts: BankVirtualAccountPublic[],
): Set<BankCurrencyCode> {
  const covered = new Set<BankCurrencyCode>();
  for (const account of virtualAccounts) {
    const code = account.currency.toLowerCase() as BankCurrencyCode;
    if (BANK_CURRENCY_METAS.some((m) => m.currency === code)) {
      covered.add(code);
    }
  }
  return covered;
}

export function getAvailableBankCurrencyCodes(
  virtualAccounts: BankVirtualAccountPublic[],
): BankCurrencyCode[] {
  const covered = getCoveredBankCurrencyCodes(virtualAccounts);
  return BANK_CURRENCY_METAS.map((m) => m.currency).filter(
    (code) => !covered.has(code),
  );
}
