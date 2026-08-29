import type { DatabaseInstance } from '../../common/server/types';
import type { Space } from '../../space/types';
import type { BankCustomer } from '@hypha-platform/storage-postgres';
import {
  DEFAULT_BANK_PROVIDER,
  PENDING_EMAIL_CONFIRMATION_VALIDATION,
} from '../constants';
import type {
  BankEndorsementPublicStatus,
  BankPendingRequirements,
  BankRailPublicStatus,
  BankValidationRequirement,
} from '../types';
import {
  mapEndorsementStatuses,
  pickPrimaryRailForEndorsement,
} from './map-endorsement-statuses';
import {
  buildCustomerValidations,
  buildRailStatuses,
  loadBankingProviderState,
  resolveCustomerApproved,
} from './providers/bridge/banking-provider-state';
import { buildBridgeSofUrl } from './providers/bridge/kyc-link-urls';
import { extractCustomerMissingFlags } from './bridge-customer-endorsements';
import { findBankCustomerBySpaceAndProvider } from './queries';

export type BankVerificationProcedurePublic = BankValidationRequirement;

export type SpaceBankCustomerPublicStatus = {
  hasCustomer: boolean;
  isApproved: boolean;
  approvalRegistered: boolean;
  procedures: {
    tos: BankVerificationProcedurePublic;
    kyc: BankVerificationProcedurePublic;
  };
  railStatuses: BankRailPublicStatus[];
  endorsementStatuses: BankEndorsementPublicStatus[];
  /** @deprecated Use endorsementStatuses — one row per Bridge endorsement */
  currencyStatuses: Array<{
    currency: string;
    endorsement: string;
    endorsementStatus: string | null;
    virtualAccountId: string | null;
    isApproved: boolean;
    operationalStatus: BankRailPublicStatus['operationalStatus'];
    validation: BankValidationRequirement;
  }>;
  requestedRails: string[];
  /** Missing requirements that need user action beyond the main KYB flow. */
  pendingRequirements?: BankPendingRequirements;
  /**
   * Set when a #2288 email-ownership confirmation is pending — no Bridge KYC link exists yet, so
   * none of the provider-derived fields above are meaningful. Drives the "confirm your email"
   * task card instead of the normal onboarding/status UI.
   */
  pendingEmailConfirmation?: { requestedRails: string[] };
};

function mapCurrencyStatuses(
  rails: BankRailPublicStatus[],
): SpaceBankCustomerPublicStatus['currencyStatuses'] {
  return mapEndorsementStatuses(rails).map((entry) => {
    const primary = pickPrimaryRailForEndorsement(
      rails.filter((rail) => rail.endorsement === entry.endorsement),
    );
    return {
      currency: primary.currency,
      endorsement: entry.endorsement,
      endorsementStatus: entry.endorsementStatus,
      virtualAccountId: primary.hasVirtualAccount ? primary.railKey : null,
      isApproved: entry.operationalStatus === 'approved',
      operationalStatus: entry.operationalStatus,
      validation: entry.validation,
    };
  });
}

export async function getSpaceBankCustomerPublicStatus(
  space: Pick<Space, 'id' | 'title'>,
  { db }: { db: DatabaseInstance },
): Promise<SpaceBankCustomerPublicStatus | null> {
  const customer = await findBankCustomerBySpaceAndProvider(
    { spaceId: space.id, provider: DEFAULT_BANK_PROVIDER },
    { db },
  );

  if (!customer) {
    return null;
  }

  return buildPublicStatusFromCustomer(customer, { db });
}

export async function buildPublicStatusFromCustomer(
  customer: BankCustomer,
  { db }: { db: DatabaseInstance },
): Promise<SpaceBankCustomerPublicStatus> {
  if (!customer.providerKycLinkId) {
    return {
      hasCustomer: true,
      isApproved: false,
      approvalRegistered: false,
      procedures: {
        tos: PENDING_EMAIL_CONFIRMATION_VALIDATION,
        kyc: PENDING_EMAIL_CONFIRMATION_VALIDATION,
      },
      railStatuses: [],
      endorsementStatuses: [],
      currencyStatuses: [],
      requestedRails: customer.requestedRails ?? [],
      pendingEmailConfirmation: {
        requestedRails: customer.requestedRails ?? [],
      },
    };
  }

  const state = await loadBankingProviderState(customer);
  const validations = buildCustomerValidations(state.kycLink);
  const railStatuses = buildRailStatuses({ customer, state });
  const isApproved = await resolveCustomerApproved(customer);

  const missing = extractCustomerMissingFlags(
    state.customer?.endorsements,
    state.customer?.associated_persons,
  );
  const sofLink =
    missing.sofMissing && state.customer?.status !== 'not_started'
      ? buildBridgeSofUrl(state.kycLink.kyc_link)
      : null;

  return {
    hasCustomer: true,
    isApproved,
    approvalRegistered: isApproved,
    procedures: {
      tos: validations.tos,
      kyc: validations.kyc,
    },
    railStatuses,
    endorsementStatuses: mapEndorsementStatuses(railStatuses),
    currencyStatuses: mapCurrencyStatuses(railStatuses),
    requestedRails: customer.requestedRails ?? [],
    pendingRequirements: {
      sofQuestionnaire: sofLink ? { link: sofLink } : null,
      pendingUbos: missing.pendingUbos,
    },
  };
}
