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

/** Completed / locked instruction fields — muted, non-interactive appearance. */
export const BANKING_READONLY_SURFACE_CLASS =
  'rounded-md border border-border/50 bg-muted/15 text-muted-foreground';

/** Callout above reference fields in transfer details (only place warning border is used). */
export const BANKING_REFERENCE_WARNING_BANNER_CLASS =
  'rounded-md border-2 border-warning-8 bg-warning-3 px-3 py-2 text-1 text-foreground';

/** @deprecated Import from `./components/banking-dialog-layout` */
export {
  BANKING_DIALOG_CONTENT_CLASS as BANKING_DETAILS_DIALOG_CONTENT_CLASS,
  BANKING_DIALOG_BODY_CLASS as BANKING_DETAILS_DIALOG_BODY_CLASS,
} from './components/banking-dialog-layout';

/** Completed transfers — instructions are view-only (no copy). */
export function isTransferDepositInstructionsReadOnly(
  transfer: Pick<BankTransferPublic, 'lifecycle' | 'status'>,
): boolean {
  return (
    transfer.lifecycle === 'active' && transfer.status === 'payment_processed'
  );
}

/** Locked customer fields — readable but not focusable like an editable input. */
export const BANKING_READONLY_INPUT_CLASS =
  'cursor-default bg-muted/30 focus-visible:ring-0 focus-visible:ring-offset-0';

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

function findCurrencyStatusForAccount(
  account: BankVirtualAccountPublic,
  status: BankCustomerPublicStatus | null | undefined,
) {
  return status?.currencyStatuses?.find(
    (entry) => entry.currency.toLowerCase() === account.currency.toLowerCase(),
  );
}

/** Align listing cards with gear using live per-currency endorsement status. */
export function enrichVirtualAccountWithCustomerStatus(
  account: BankVirtualAccountPublic,
  status: BankCustomerPublicStatus | null | undefined,
): BankVirtualAccountPublic {
  if (account.lifecycle === 'active') {
    return account;
  }

  const currencyStatus = findCurrencyStatusForAccount(account, status);
  if (!currencyStatus) {
    return account;
  }

  switch (currencyStatus.operationalStatus) {
    case 'active':
      return {
        ...account,
        lifecycle: 'active',
        canActivate: false,
        canContinueVerification: false,
        isApproved: true,
      };
    case 'approved':
      return {
        ...account,
        lifecycle: 'pending_activation',
        canActivate: true,
        canContinueVerification: false,
        isApproved: true,
      };
    case 'pending':
      return {
        ...account,
        lifecycle: 'pending_kyb',
        canActivate: false,
        canContinueVerification: false,
      };
    case 'not_approved':
    case 'not_opened':
      return {
        ...account,
        lifecycle: 'pending_kyb',
        canActivate: false,
        canContinueVerification: false,
      };
    default:
      return account;
  }
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
  // Only count corridors with a DB bank_virtual_accounts row (from GET /banking/accounts).
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
