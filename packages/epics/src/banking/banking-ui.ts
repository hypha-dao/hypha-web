import {
  getDefaultDestinationCurrency,
  getDestinationCurrenciesForSourceRail,
  BANK_PAYOUT_RAILS,
  BANK_VIRTUAL_ACCOUNT_CURRENCIES,
} from '@hypha-platform/core/client';

import {
  BANK_CURRENCY_METAS,
  BANK_TRANSFER_CORRIDOR_KEYS,
  getTransferCorridorMeta,
  type BankCurrencyCode,
  type BankTransferCorridorKey,
} from './bank-currency-display';
import type {
  BankAddAccountRailOption,
  BankCustomerPublicStatus,
  BankEndorsementPublicStatus,
  BankRailPublicStatus,
  BankTransferRailOption,
  BankTransferPublic,
  BankVirtualAccountPublic,
} from './hooks/types';

/** Keep in sync with `AssetsList` in treasury/components/assets/assets-list.tsx */
export const TREASURY_CARD_GRID_CLASS =
  'mt-2 grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4';

export const BANKING_EMPTY_STATE_CLASS =
  'my-4 flex min-h-[9rem] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background-2/50 px-5 py-7 text-center';

export const BANKING_LOADING_STATE_CLASS =
  'my-4 flex min-h-[9rem] flex-col items-center justify-center gap-2 rounded-lg border border-border bg-background-2/50 px-5 py-7 text-center';

export const BANKING_COPYABLE_SURFACE_CLASS =
  'rounded-md border border-border/70 bg-muted/25';

export const BANKING_READONLY_SURFACE_CLASS =
  'rounded-md border border-border/50 bg-muted/15 text-muted-foreground';

export const BANKING_REFERENCE_WARNING_BANNER_CLASS =
  'rounded-md border-2 border-warning-8 bg-warning-3 px-3 py-2 text-1 text-foreground';

export {
  BANKING_DIALOG_CONTENT_CLASS as BANKING_DETAILS_DIALOG_CONTENT_CLASS,
  BANKING_DIALOG_BODY_CLASS as BANKING_DETAILS_DIALOG_BODY_CLASS,
} from './components/banking-dialog-layout';

export function procedureLink(
  procedure: BankCustomerPublicStatus['procedures']['kyc'],
): string | null {
  return procedure.action?.url ?? procedure.link ?? null;
}

export function isTransferDepositInstructionsReadOnly(
  transfer: Pick<BankTransferPublic, 'status'>,
): boolean {
  return transfer.status === 'payment_processed';
}

export const BANKING_READONLY_INPUT_CLASS =
  'cursor-default bg-muted/30 focus-visible:ring-0 focus-visible:ring-offset-0';

export function isBankVerificationInProgress(
  status: BankCustomerPublicStatus | null | undefined,
): boolean {
  if (!status || status.isApproved || status.approvalRegistered) {
    return false;
  }
  const { procedures } = status;
  if (!procedures) {
    return true;
  }
  return !procedures.tos?.isComplete || !procedures.kyc?.isComplete;
}

function groupRailStatusesByEndorsement(
  rails: BankRailPublicStatus[],
): BankEndorsementPublicStatus[] {
  const groups = new Map<string, BankRailPublicStatus[]>();

  for (const rail of rails) {
    const list = groups.get(rail.endorsement) ?? [];
    list.push(rail);
    groups.set(rail.endorsement, list);
  }

  return [...groups.entries()].map(([endorsement, group]) => {
    const primary =
      group.find((rail) => rail.railKey === rail.currency) ?? group[0]!;
    return {
      endorsement,
      endorsementStatus: primary.endorsementStatus,
      operationalStatus: primary.operationalStatus,
      validation: primary.validation,
    };
  });
}

/** Endorsement rows for gear / status UI — tolerates partial API payloads. */
export function getBankEndorsementStatusesForPanel(
  status: BankCustomerPublicStatus,
): BankEndorsementPublicStatus[] {
  if (status.endorsementStatuses?.length) {
    return status.endorsementStatuses;
  }

  const currencies = status.currencyStatuses ?? [];
  if (currencies.length > 0) {
    return currencies.map((entry) => ({
      endorsement: entry.endorsement,
      endorsementStatus: entry.endorsementStatus,
      operationalStatus: entry.operationalStatus,
      validation: entry.validation ?? {
        key: entry.endorsement,
        status: entry.endorsementStatus,
        isComplete: entry.isApproved,
      },
    }));
  }

  const rails = status.railStatuses ?? [];
  if (rails.length > 0) {
    return groupRailStatusesByEndorsement(rails);
  }

  return [];
}

export function isCustomerReadyForBankOperations(
  status: BankCustomerPublicStatus | null | undefined,
): boolean {
  if (!status) {
    return false;
  }
  return status.isApproved || status.approvalRegistered;
}

/** At least one requested currency has an approved/active Bridge endorsement. */
export function hasApprovedBankCurrencies(
  status: BankCustomerPublicStatus | null | undefined,
): boolean {
  if (!status) {
    return false;
  }
  if (status.currencyStatuses?.some((entry) => entry.isApproved)) {
    return true;
  }

  return getBankEndorsementStatusesForPanel(status).some(
    (entry) =>
      entry.operationalStatus === 'approved' ||
      entry.operationalStatus === 'active',
  );
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

const VA_CURRENCY_SET = new Set(
  BANK_CURRENCY_METAS.map((meta) => meta.currency),
);

/** Rails that can receive a new virtual account — derived from bank-customers status (no extra Bridge fetch). */
export function getAddAccountRailOptionsFromStatus(
  status: BankCustomerPublicStatus,
): BankAddAccountRailOption[] {
  const sortOrder: Record<string, number> = {
    approved: 0,
    pending: 1,
    not_approved: 2,
    not_requested: 3,
    active: 4,
  };

  return status.railStatuses
    .filter(
      (rail) =>
        VA_CURRENCY_SET.has(rail.currency as BankCurrencyCode) &&
        rail.railKey === rail.currency,
    )
    .map((rail) => ({
      railKey: rail.railKey,
      currency: rail.currency,
      paymentRail: rail.paymentRail,
      endorsement: rail.endorsement,
      operationalStatus: rail.operationalStatus,
      validation: rail.validation,
      hasVirtualAccount: rail.hasVirtualAccount,
      destinationCurrencies: [
        ...getDestinationCurrenciesForSourceRail(rail.paymentRail),
      ],
      defaultDestinationCurrency: getDefaultDestinationCurrency({
        sourceCurrency: rail.currency,
        sourceRail: rail.paymentRail,
      }),
    }))
    .sort(
      (a, b) =>
        (sortOrder[a.operationalStatus] ?? 99) -
        (sortOrder[b.operationalStatus] ?? 99),
    );
}

/** Provisioned (source currency, destination currency) pairs, keyed `${currency}:${destination}`. */
export function getCoveredAccountPairs(
  virtualAccounts: BankVirtualAccountPublic[],
): Set<string> {
  const covered = new Set<string>();
  for (const account of virtualAccounts) {
    const destination = account.depositInstructions.destination_currency;
    if (typeof destination === 'string') {
      covered.add(
        `${account.currency.toLowerCase()}:${destination.toLowerCase()}`,
      );
    }
  }
  return covered;
}

/**
 * Add-account options with already-provisioned (currency, destination) pairs
 * removed. A currency drops out of the list only once every destination
 * currency it supports has an account; otherwise it stays, with the remaining
 * destination currencies offered.
 */
export function getAvailableAddAccountRailOptions(
  status: BankCustomerPublicStatus,
  virtualAccounts: BankVirtualAccountPublic[],
): BankAddAccountRailOption[] {
  const covered = getCoveredAccountPairs(virtualAccounts);
  const enabledCurrencies = new Set(getEnabledDepositCurrencies());
  return getAddAccountRailOptionsFromStatus(status)
    .filter((option) => enabledCurrencies.has(option.currency))
    .map((option) => {
      const destinationCurrencies = option.destinationCurrencies.filter(
        (destination) =>
          !covered.has(
            `${option.currency.toLowerCase()}:${destination.toLowerCase()}`,
          ),
      );
      const defaultDestinationCurrency = destinationCurrencies.includes(
        option.defaultDestinationCurrency,
      )
        ? option.defaultDestinationCurrency
        : destinationCurrencies[0] ?? option.defaultDestinationCurrency;
      return { ...option, destinationCurrencies, defaultDestinationCurrency };
    })
    .filter((option) => option.destinationCurrencies.length > 0);
}

/** One-time transfer corridors — derived from bank-customers status (no extra Bridge fetch). */
export function getTransferRailOptionsFromStatus(
  status: BankCustomerPublicStatus,
): BankTransferRailOption[] {
  const sortOrder: Record<string, number> = {
    approved: 0,
    active: 0,
    pending: 1,
    not_approved: 2,
    not_requested: 3,
  };

  const byCorridor = new Map(
    status.railStatuses
      .filter((rail) =>
        (BANK_TRANSFER_CORRIDOR_KEYS as readonly string[]).includes(
          rail.railKey,
        ),
      )
      .map((rail) => [rail.railKey, rail]),
  );

  return (BANK_TRANSFER_CORRIDOR_KEYS as readonly BankTransferCorridorKey[])
    .map((corridorKey): BankTransferRailOption | null => {
      const meta = getTransferCorridorMeta(corridorKey);
      const rail = byCorridor.get(corridorKey);
      if (!meta || !rail) {
        return null;
      }

      return {
        railKey: corridorKey,
        currency: meta.currency,
        paymentRail: meta.paymentRail,
        endorsement: rail.endorsement,
        operationalStatus: rail.operationalStatus,
        validation: rail.validation,
        destinationCurrencies: [
          ...getDestinationCurrenciesForSourceRail(meta.paymentRail),
        ],
        defaultDestinationCurrency: getDefaultDestinationCurrency({
          sourceCurrency: meta.currency,
          sourceRail: meta.paymentRail,
        }),
      };
    })
    .filter((option): option is BankTransferRailOption => option != null)
    .sort(
      (a, b) =>
        (sortOrder[a.operationalStatus] ?? 99) -
        (sortOrder[b.operationalStatus] ?? 99),
    );
}

export function hasAddAccountRailAvailable(
  status: BankCustomerPublicStatus | null | undefined,
  virtualAccounts: BankVirtualAccountPublic[],
): boolean {
  if (!status) {
    return false;
  }
  return getAvailableAddAccountRailOptions(status, virtualAccounts).length > 0;
}

/**
 * Returns the subset of deposit currencies enabled via
 * NEXT_PUBLIC_BANKING_SUPPORTED_DEPOSIT_RAILS. When the env var is unset or
 * empty all currencies are considered enabled (open-world default).
 * Valid values: usd, eur, gbp, mxn, brl, cop
 */
export function getEnabledDepositCurrencies(): readonly string[] {
  const raw = process.env.NEXT_PUBLIC_BANKING_SUPPORTED_DEPOSIT_RAILS?.trim();
  if (!raw) return BANK_VIRTUAL_ACCOUNT_CURRENCIES;
  const allowed = new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  return BANK_VIRTUAL_ACCOUNT_CURRENCIES.filter((c) =>
    allowed.has(c.toLowerCase()),
  );
}

export function isBankRailSelectable(
  status: BankCustomerPublicStatus['railStatuses'][number]['operationalStatus'],
): boolean {
  return status === 'approved' || status === 'active';
}

export function bankRailNeedsEndorsementRequest(
  status: BankCustomerPublicStatus['railStatuses'][number]['operationalStatus'],
): boolean {
  return status === 'not_requested';
}

/**
 * Returns the Bridge endorsement `operationalStatus` for a payout rail as
 * reported in `BankCustomerPublicStatus.endorsementStatuses`.
 *
 * Call with `payoutCurrencyToRailKey(currency)` to get the railKey from a
 * `PayoutCurrencyKey`. Returns `'not_requested'` when the status is missing
 * or the endorsement is not yet listed.
 */
export function getPayoutRailEndorsementStatus(
  railKey: string,
  status: BankCustomerPublicStatus | null | undefined,
): BankEndorsementPublicStatus['operationalStatus'] {
  if (!status) return 'not_requested';
  const railConfig =
    BANK_PAYOUT_RAILS[railKey as keyof typeof BANK_PAYOUT_RAILS];
  if (!railConfig) return 'not_requested';
  const endorsementEntry = status.endorsementStatuses?.find(
    (e) => e.endorsement === railConfig.endorsement,
  );
  return endorsementEntry?.operationalStatus ?? 'not_requested';
}
