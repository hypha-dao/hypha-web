import 'server-only';

import {
  bridgeGetCustomer,
  bridgeGetKycLink,
  bridgeListLiquidationAddresses,
  bridgeListVirtualAccounts,
  type BridgeCreateKycLinkResponse,
  type BridgeGetCustomerResponse,
} from '../../../../common/server/bridge-client';
import type { BankCustomer } from '@hypha-platform/storage-postgres';
import {
  BANK_CURRENCY_TO_ENDORSEMENT,
  BANK_TRANSFER_CORRIDORS,
  BANK_VIRTUAL_ACCOUNT_CURRENCIES,
  BRIDGE_LIQUIDATION_SOURCE_CHAIN,
  getPaymentRailForCurrency,
  type BankTransferCorridorKey,
  type BankVirtualAccountCurrency,
} from '../../../constants';
import { BRIDGE_DEFAULT_DESTINATION_CURRENCY } from '../../../bridge-destination-currencies';
import {
  isBridgeEndorsementApproved,
  parseBridgeCustomerEndorsements,
} from '../../bridge-customer-endorsements';
import {
  fetchBridgeKycLinkLive,
  isBridgeKycProcedureSubmitted,
  isBridgeTosProcedureSubmitted,
} from '../../fetch-bridge-kyc-link-live';
import { mapBridgeKycLinkUrls } from './kyc-link-urls';
import type {
  BankRailOperationalStatus,
  BankRailPublicStatus,
  BankValidationRequirement,
} from '../../../types';

const PENDING_BRIDGE_ENDORSEMENT_STATUSES = new Set([
  'incomplete',
  'not_started',
  'under_review',
  'awaiting_questionnaire',
  'awaiting_ubo',
  'paused',
]);

export type BankingProviderState = {
  kycLink: BridgeCreateKycLinkResponse;
  customer: BridgeGetCustomerResponse | null;
  virtualAccountKeys: Set<string>;
  /** Provisioned `${currency}:${destinationCurrency}` pairs — dedup key for account creation. */
  virtualAccountPairs: Set<string>;
  /** Provisioned `${chain}:${sourceCurrency}:${externalAccountId}` liquidation address pairs. */
  liquidationAddressPairs: Set<string>;
};

function vaKey(currency: string, paymentRail: string): string {
  return `${currency.toLowerCase()}:${paymentRail.toLowerCase()}`;
}

export function vaPairKey(
  currency: string,
  destinationCurrency: string,
): string {
  return `${currency.toLowerCase()}:${destinationCurrency.toLowerCase()}`;
}

export function laPairKey(
  chain: string,
  sourceCurrency: string,
  externalAccountId: string,
): string {
  return `${chain.toLowerCase()}:${sourceCurrency.toLowerCase()}:${externalAccountId}`;
}

export async function loadBankingProviderState(
  customer: BankCustomer,
): Promise<BankingProviderState> {
  const kycLink = await bridgeGetKycLink(customer.providerKycLinkId);

  let bridgeCustomer: BridgeGetCustomerResponse | null = null;
  const customerId = customer.providerCustomerId ?? kycLink.customer_id ?? null;

  if (customerId) {
    bridgeCustomer = await bridgeGetCustomer(customerId);
  }

  const virtualAccountKeys = new Set<string>();
  const virtualAccountPairs = new Set<string>();
  const liquidationAddressPairs = new Set<string>();
  if (customerId) {
    const listed = await bridgeListVirtualAccounts(customerId, { limit: 100 });
    for (const account of listed.data) {
      const currency =
        account.source?.currency ??
        (typeof account.source_deposit_instructions.currency === 'string'
          ? account.source_deposit_instructions.currency
          : '');
      const paymentRails = account.source_deposit_instructions.payment_rails;
      const rail =
        account.source?.payment_rail ??
        (Array.isArray(paymentRails) && typeof paymentRails[0] === 'string'
          ? paymentRails[0]
          : getPaymentRailForCurrency(currency) ?? '');
      if (currency && rail) {
        virtualAccountKeys.add(vaKey(currency, rail));
      }
      if (currency) {
        const destinationCurrency =
          account.destination?.currency ?? BRIDGE_DEFAULT_DESTINATION_CURRENCY;
        virtualAccountPairs.add(vaPairKey(currency, destinationCurrency));
      }
    }

    const liquidationListed = await bridgeListLiquidationAddresses(customerId, {
      limit: 100,
    });
    for (const liquidation of liquidationListed.data) {
      if (liquidation.external_account_id) {
        liquidationAddressPairs.add(
          laPairKey(
            liquidation.chain ?? BRIDGE_LIQUIDATION_SOURCE_CHAIN,
            liquidation.currency,
            liquidation.external_account_id,
          ),
        );
      }
    }
  }

  return {
    kycLink,
    customer: bridgeCustomer,
    virtualAccountKeys,
    virtualAccountPairs,
    liquidationAddressPairs,
  };
}

function buildProcedureRequirement(input: {
  key: string;
  registered: string | null;
  live: string | null | undefined;
  url: string | null;
  isComplete: (status: string | null | undefined) => boolean;
}): BankValidationRequirement {
  const status = input.live ?? input.registered;
  const isComplete =
    input.key === 'kyc'
      ? input.registered === 'approved' || input.live === 'approved'
      : input.isComplete(status);

  const linkDisabled =
    isComplete ||
    (input.key === 'kyc'
      ? isBridgeKycProcedureSubmitted(input.live) ||
        isBridgeKycProcedureSubmitted(input.registered)
      : isBridgeTosProcedureSubmitted(input.live) ||
        isBridgeTosProcedureSubmitted(input.registered));

  return {
    key: input.key,
    status,
    isComplete,
    action:
      input.url && !linkDisabled ? { type: 'link', url: input.url } : undefined,
    linkDisabled,
  };
}

export function buildCustomerValidations(
  kycLink: BridgeCreateKycLinkResponse,
): {
  tos: BankValidationRequirement;
  kyc: BankValidationRequirement;
  kycLink: string;
  tosLink: string | null;
} {
  const { kycLink: kycUrl, tosLink } = mapBridgeKycLinkUrls(kycLink);

  return {
    kycLink: kycUrl,
    tosLink,
    tos: buildProcedureRequirement({
      key: 'tos',
      registered: kycLink.tos_status ?? null,
      live: kycLink.tos_status ?? null,
      url: tosLink,
      isComplete: isBridgeTosProcedureSubmitted,
    }),
    kyc: buildProcedureRequirement({
      key: 'kyc',
      registered: kycLink.kyc_status,
      live: kycLink.kyc_status,
      url: kycUrl,
      isComplete: (s) => s === 'approved',
    }),
  };
}

function resolveRailOperationalStatus(input: {
  endorsementStatus: string | null;
  hasVirtualAccount: boolean;
  enabled: boolean;
}): BankRailOperationalStatus {
  if (input.hasVirtualAccount) {
    return 'active';
  }

  if (!input.enabled) {
    return 'not_requested';
  }

  if (isBridgeEndorsementApproved(input.endorsementStatus)) {
    return 'approved';
  }

  if (
    input.endorsementStatus &&
    PENDING_BRIDGE_ENDORSEMENT_STATUSES.has(input.endorsementStatus)
  ) {
    return 'pending';
  }

  if (input.endorsementStatus) {
    return 'not_approved';
  }

  return 'not_requested';
}

export function buildRailStatuses(input: {
  customer: BankCustomer;
  state: BankingProviderState;
}): BankRailPublicStatus[] {
  const endorsementMap = input.state.customer
    ? parseBridgeCustomerEndorsements(input.state.customer.endorsements)
    : new Map<string, string>();

  const validations = buildCustomerValidations(input.state.kycLink);
  const enabledSet = new Set(
    (input.customer.requestedRails ?? []).map((r) => r.toLowerCase()),
  );

  const rails: BankRailPublicStatus[] = [];

  for (const currency of BANK_VIRTUAL_ACCOUNT_CURRENCIES) {
    const endorsement =
      BANK_CURRENCY_TO_ENDORSEMENT[currency as BankVirtualAccountCurrency];
    const paymentRail = getPaymentRailForCurrency(currency) ?? endorsement;
    const endorsementStatus = endorsementMap.get(endorsement) ?? null;
    const hasVirtualAccount = input.state.virtualAccountKeys.has(
      vaKey(currency, paymentRail),
    );
    const enabled = enabledSet.has(currency.toLowerCase());

    const operationalStatus = resolveRailOperationalStatus({
      endorsementStatus,
      hasVirtualAccount,
      enabled,
    });

    const needsAction =
      operationalStatus === 'not_approved' || operationalStatus === 'pending';

    rails.push({
      railKey: currency,
      currency,
      paymentRail,
      endorsement,
      endorsementStatus,
      operationalStatus,
      hasVirtualAccount,
      validation: {
        key: endorsement,
        status: endorsementStatus,
        isComplete:
          operationalStatus === 'active' || operationalStatus === 'approved',
        action:
          needsAction && validations.kyc.action
            ? validations.kyc.action
            : undefined,
        linkDisabled: !needsAction,
      },
    });
  }

  for (const corridorKey of Object.keys(
    BANK_TRANSFER_CORRIDORS,
  ) as BankTransferCorridorKey[]) {
    const corridor = BANK_TRANSFER_CORRIDORS[corridorKey];
    if (
      rails.some(
        (r) =>
          r.currency === corridor.currency &&
          r.paymentRail === corridor.paymentRail,
      )
    ) {
      continue;
    }

    const endorsement =
      BANK_CURRENCY_TO_ENDORSEMENT[
        corridor.currency as BankVirtualAccountCurrency
      ];
    const endorsementStatus = endorsementMap.get(endorsement) ?? null;
    const enabled = enabledSet.has(corridor.currency.toLowerCase());
    const operationalStatus = resolveRailOperationalStatus({
      endorsementStatus,
      hasVirtualAccount: false,
      enabled,
    });

    rails.push({
      railKey: corridorKey,
      currency: corridor.currency,
      paymentRail: corridor.paymentRail,
      endorsement,
      endorsementStatus,
      operationalStatus,
      hasVirtualAccount: false,
      validation: {
        key: corridorKey,
        status: endorsementStatus,
        isComplete: operationalStatus === 'approved',
        action:
          operationalStatus === 'not_approved' ||
          operationalStatus === 'pending'
            ? validations.kyc.action
            : undefined,
        linkDisabled:
          operationalStatus === 'active' || operationalStatus === 'approved',
      },
    });
  }

  return rails;
}

export async function resolveCustomerApproved(
  customer: BankCustomer,
): Promise<boolean> {
  const live = await fetchBridgeKycLinkLive(customer);
  return Boolean(live?.isKycApproved && live?.isTosApproved);
}

export async function syncProviderCustomerIdFromKycLink(
  customer: BankCustomer,
): Promise<string | null> {
  const live = await fetchBridgeKycLinkLive(customer);
  return live?.providerCustomerId ?? customer.providerCustomerId ?? null;
}
