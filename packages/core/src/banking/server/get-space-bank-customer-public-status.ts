import type { DatabaseInstance } from '../../common/server/types';
import type { Space } from '../../space/types';
import type { BankCustomer } from '@hypha-platform/storage-postgres';
import {
  DEFAULT_BANK_PROVIDER,
  PENDING_EMAIL_CONFIRMATION_VALIDATION,
} from '../constants';
import type { BankProvider } from '../types';
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
import { getBankIdentityProvider } from './providers/registry';
import {
  findBankCustomerBySpaceAndProvider,
  findBankCustomersBySpace,
} from './queries';

export type BankVerificationProcedurePublic = BankValidationRequirement;

/**
 * One provider's banking status for an owner (D11 — multi-provider status). Identity-only
 * providers (AUDD today) populate the shared identity fields and leave the money-movement fields
 * (`railStatuses`/`endorsementStatuses`/`currencyStatuses`/`pendingRequirements`) empty — those
 * are a Bridge-specific capability (D5: money-movement generalization is carried forward to the
 * Mint ticket), not a separate shape.
 */
export type BankProviderStatusEntry = {
  provider: BankProvider;
  hasCustomer: boolean;
  isApproved: boolean;
  approvalRegistered: boolean;
  procedures: {
    /** `null` for providers with no separate terms-of-service step (AUDD). */
    tos: BankVerificationProcedurePublic | null;
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
   * Set when a #2288 email-ownership confirmation is pending — no provider KYC resource exists
   * yet, so none of the provider-derived fields above are meaningful. Drives the "confirm your
   * email" task card instead of the normal onboarding/status UI.
   */
  pendingEmailConfirmation?: { requestedRails: string[] };
};

/** @deprecated Use `BankProviderStatusEntry` — kept as an alias, same shape. */
export type SpaceBankCustomerPublicStatus = BankProviderStatusEntry;

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
): Promise<
  BankProviderStatusEntry & {
    procedures: { tos: BankVerificationProcedurePublic };
  }
> {
  // `provider` is DB free-text (D3: no enum); the Bridge-only builder always sees a Bridge row.
  const provider = customer.provider as BankProvider;

  if (!customer.providerKycLinkId) {
    return {
      provider,
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
    provider,
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

/**
 * Status builder for identity-only providers (AUDD today) — D11. No rails, no endorsements, no
 * money movement; built entirely from `BankIdentityProvider.getKycStatus` + the adapter's own
 * onboarding-step descriptor (D12), so nothing here is AUDD-specific.
 */
async function buildIdentityOnlyPublicStatus(
  customer: BankCustomer,
): Promise<BankProviderStatusEntry> {
  // `provider` is DB free-text (D3: no enum); callers only route non-Bridge rows here.
  const provider = customer.provider as BankProvider;
  const base: Pick<
    BankProviderStatusEntry,
    | 'provider'
    | 'railStatuses'
    | 'endorsementStatuses'
    | 'currencyStatuses'
    | 'requestedRails'
  > = {
    provider,
    railStatuses: [],
    endorsementStatuses: [],
    currencyStatuses: [],
    requestedRails: customer.requestedRails ?? [],
  };

  if (!customer.providerCustomerId) {
    return {
      ...base,
      hasCustomer: true,
      isApproved: false,
      approvalRegistered: false,
      procedures: { tos: null, kyc: PENDING_EMAIL_CONFIRMATION_VALIDATION },
      pendingEmailConfirmation: { requestedRails: base.requestedRails },
    };
  }

  const identityProvider = getBankIdentityProvider(provider);
  const kycResult = await identityProvider.getKycStatus({ customer });

  if (!kycResult) {
    return {
      ...base,
      hasCustomer: true,
      isApproved: false,
      approvalRegistered: false,
      procedures: {
        tos: null,
        kyc: { key: 'kyc', status: null, isComplete: false },
      },
    };
  }

  // D16: AUDD never returns a re-fetchable link from getKycStatus (kycLink is always null there)
  // — the step descriptor then just has no `url`, which the shared renderer already handles.
  const stepDescriptor = kycResult.kycLink
    ? identityProvider.getOnboardingStepDescriptor({
        kycLink: kycResult.kycLink,
      })
    : null;

  const kycProcedure: BankVerificationProcedurePublic = {
    key: 'kyc',
    status: kycResult.kycStatus,
    isComplete: kycResult.isApproved,
    ...(stepDescriptor?.url
      ? { action: { type: 'link' as const, url: stepDescriptor.url } }
      : {}),
  };

  return {
    ...base,
    hasCustomer: true,
    isApproved: kycResult.isApproved,
    approvalRegistered: kycResult.isApproved,
    procedures: { tos: null, kyc: kycProcedure },
  };
}

/** Builds each row's status entry, routing Bridge rows through the rich builder (unchanged) and
 * every other provider through the identity-only builder (D11). */
export async function getBankCustomerPublicStatuses(
  customers: readonly BankCustomer[],
  { db }: { db: DatabaseInstance },
): Promise<BankProviderStatusEntry[]> {
  return Promise.all(
    customers.map((customer) =>
      customer.provider === DEFAULT_BANK_PROVIDER
        ? buildPublicStatusFromCustomer(customer, { db })
        : buildIdentityOnlyPublicStatus(customer),
    ),
  );
}

/** Every provider's status for a space (D11) — one entry per `bank_customers` row (D3). */
export async function getSpaceBankCustomerPublicStatuses(
  space: Pick<Space, 'id' | 'title'>,
  { db }: { db: DatabaseInstance },
): Promise<BankProviderStatusEntry[]> {
  const customers = await findBankCustomersBySpace(space.id, { db });
  return getBankCustomerPublicStatuses(customers, { db });
}
