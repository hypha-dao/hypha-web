import 'server-only';

import type {
  BankCustomer,
  BankVirtualAccount,
} from '@hypha-platform/storage-postgres';

import type {
  BankCurrencyOperationalStatus,
  BankCurrencyPublicStatus,
} from '../types';
import {
  BANK_CURRENCY_TO_ENDORSEMENT,
  type BankVirtualAccountCurrency,
} from '../constants';
import {
  getEndorsementForCurrency,
  isBridgeEndorsementApproved,
  resolveEndorsementStatusFromMap,
  type BridgeEndorsementStatusMap,
} from './bridge-customer-endorsements';

const PENDING_BRIDGE_ENDORSEMENT_STATUSES = new Set([
  'incomplete',
  'not_started',
  'under_review',
  'awaiting_questionnaire',
  'awaiting_ubo',
  'paused',
]);

function resolveOperationalStatus(input: {
  hasVirtualAccount: boolean;
  hasProviderResource: boolean;
  corridorApproved: boolean;
  endorsementStatus: string | null;
}): BankCurrencyOperationalStatus {
  if (input.hasProviderResource) {
    return 'active';
  }

  if (!input.hasVirtualAccount) {
    if (
      input.endorsementStatus &&
      PENDING_BRIDGE_ENDORSEMENT_STATUSES.has(input.endorsementStatus)
    ) {
      return 'pending';
    }

    return 'not_opened';
  }

  if (input.corridorApproved) {
    return 'approved';
  }

  if (
    input.endorsementStatus &&
    PENDING_BRIDGE_ENDORSEMENT_STATUSES.has(input.endorsementStatus)
  ) {
    return 'pending';
  }

  return 'not_approved';
}

export function buildBankCurrencyPublicStatuses(input: {
  customer: BankCustomer;
  accounts: BankVirtualAccount[];
  endorsementStatusMap?: BridgeEndorsementStatusMap;
}): BankCurrencyPublicStatus[] {
  const { customer, accounts, endorsementStatusMap } = input;
  const accountByCurrency = new Map(
    accounts.map((account) => [account.currency, account]),
  );

  const currencies = new Set<string>([
    ...(
      Object.entries(BANK_CURRENCY_TO_ENDORSEMENT) as Array<
        [BankVirtualAccountCurrency, string]
      >
    )
      .filter(([, endorsement]) => customer.endorsements.includes(endorsement))
      .map(([currency]) => currency),
    ...accounts.map((account) => account.currency),
  ]);

  return [...currencies].sort().map((currency) => {
    const endorsement = getEndorsementForCurrency(currency) ?? currency;
    const account = accountByCurrency.get(currency);
    const endorsementStatus = endorsementStatusMap
      ? resolveEndorsementStatusFromMap(endorsementStatusMap, endorsement)
      : null;
    const hasVirtualAccount = Boolean(account);
    const liveApproved = isBridgeEndorsementApproved(endorsementStatus);
    const corridorApproved =
      Boolean(account?.providerVirtualAccountId) ||
      account?.isApproved === true ||
      (hasVirtualAccount && liveApproved);

    return {
      currency,
      endorsement,
      endorsementStatus,
      virtualAccountId: account?.id ?? null,
      isApproved: corridorApproved,
      operationalStatus: resolveOperationalStatus({
        hasVirtualAccount,
        hasProviderResource: Boolean(account?.providerVirtualAccountId),
        corridorApproved,
        endorsementStatus,
      }),
    };
  });
}
