import type { BankCustomer } from '@hypha-platform/storage-postgres';

import type { BankEntityType, BankProvider } from '../../types';

export type CreateKycLinkInput = {
  entityType: BankEntityType;
  legalName: string;
  contactEmail: string;
  idempotencyKey: string;
  endorsements?: string[];
  redirectUri?: string;
};

export type CreateKycLinkResult = {
  providerCustomerId: string | null;
  providerKycLinkId: string;
  kycStatus: string;
  isApproved: boolean;
  tosStatus: string | null;
  kycLink: string;
  tosLink: string | null;
};

export type ProvisionVirtualAccountInput = {
  customerId: string;
  currency: string;
  destinationAddress: string;
  destinationCurrency?: string;
  idempotencyKey: string;
};

export type ProvisionVirtualAccountResult = {
  providerVirtualAccountId: string;
  currency: string;
  paymentRail: string;
  depositInstructions: Record<string, unknown>;
  status: string;
  developerFeePercent?: string | null;
  destination?: {
    currency: string;
    paymentRail: string;
    address: string;
  };
};

export type CreateTransferInput = {
  customerId: string;
  currency: string;
  paymentRail: string;
  destinationAddress: string;
  destinationCurrency?: string;
  amount?: string;
  idempotencyKey: string;
};

export type CreateTransferResult = {
  providerTransferId: string;
  currency: string;
  paymentRail: string;
  amount: string | null;
  depositMessage: string;
  depositInstructions: Record<string, unknown>;
  status: string;
  developerFeePercent?: string | null;
  destination?: {
    currency: string;
    paymentRail: string;
    address: string;
  };
};

/**
 * Provider-neutral onboarding-step descriptor (D12). Each adapter fills one in; a single shared
 * renderer (epics) draws it for every provider — not per-provider UI components.
 */
export type BankOnboardingStepDescriptor = {
  /** Discriminator for the shared renderer. Only a hosted external KYC link exists today. */
  kind: 'external_kyc_link';
  /** Hosted KYC/verification URL the user is sent to. `null` until a link has been created. */
  url: string | null;
  /** i18n message keys the shared renderer resolves for this step's copy. */
  i18nKeys: {
    title: string;
    body?: string;
  };
};

/**
 * A single field an adapter needs collected to create a customer (D10). The onboarding form
 * renders the deduped union of these across the providers for the currencies being onboarded.
 */
export type BankOnboardingFieldDescriptor = {
  /** Stable field key — also the key this value travels under inside the #2288 confirmation token. */
  key: string;
  kind: 'text' | 'email' | 'select';
  required: boolean;
  /** i18n key for the field label. */
  i18nLabelKey: string;
  /** Present when `kind` is `'select'`. */
  options?: ReadonlyArray<{ value: string; i18nLabelKey: string }>;
};

export type GetKycStatusInput = {
  /**
   * Slice of the persisted `bank_customers` row. Each adapter reads only the fields it needs;
   * `provider` lets an adapter assert it was handed its own row.
   */
  customer: Pick<
    BankCustomer,
    'provider' | 'providerKycLinkId' | 'providerCustomerId'
  >;
};

/** Provider-neutral KYC status snapshot. */
export type KycStatusResult = {
  kycStatus: string;
  isApproved: boolean;
  tosStatus: string | null;
  kycLink: string | null;
};

/**
 * The narrow, identity/KYC-only capability every bank provider must implement (D6). Onboarding and
 * the multi-provider status read depend only on this; `BankKycProvider` extends it with money
 * movement. The AUDD adapter implements only `BankIdentityProvider`.
 */
export interface BankIdentityProvider {
  readonly provider: BankProvider;
  /** Fields the onboarding form must collect for this provider to create a customer (D10). */
  readonly requiredOnboardingFields: ReadonlyArray<BankOnboardingFieldDescriptor>;
  createKycLink(input: CreateKycLinkInput): Promise<CreateKycLinkResult>;
  /**
   * Live KYC status for a persisted customer. Returns `null` when the row has no provider-side
   * KYC resource yet (e.g. a #2288 pending-email-confirmation row) — callers render the pending
   * placeholder in that case.
   */
  getKycStatus(input: GetKycStatusInput): Promise<KycStatusResult | null>;
  /** Structured descriptor for the shared onboarding-step renderer (D12). */
  getOnboardingStepDescriptor(
    result: Pick<CreateKycLinkResult, 'kycLink'>,
  ): BankOnboardingStepDescriptor;
}

export interface BankKycProvider extends BankIdentityProvider {
  provisionVirtualAccount(
    input: ProvisionVirtualAccountInput,
  ): Promise<ProvisionVirtualAccountResult>;
  createTransfer(input: CreateTransferInput): Promise<CreateTransferResult>;
  registerExternalAccount(
    input: RegisterExternalAccountInput,
  ): Promise<RegisterExternalAccountResult>;
  createLiquidationAddress(
    input: CreateLiquidationAddressInput,
  ): Promise<CreateLiquidationAddressResult>;
}

export type RegisterExternalAccountInput = {
  customerId: string;
  railKey: string;
  bankName: string;
  accountName: string;
  accountOwnerName: string;
  accountOwnerType?: 'business' | 'individual';
  firstName?: string;
  lastName?: string;
  businessName?: string;
  routingNumber?: string;
  accountNumber?: string;
  checkingOrSavings?: 'checking' | 'savings';
  iban?: string;
  bic?: string;
  sortCode?: string;
  destinationCurrency?: string;
  // SWIFT-specific fields
  swiftAccountFormat?: 'iban' | 'other';
  swiftIbanCountry?: string;
  swiftBankAddress?: {
    street_line_1: string;
    city: string;
    postal_code?: string;
    country: string;
    state?: string;
  };
  swiftCategory?: string;
  swiftPurposeOfFunds?: string[];
  swiftBusinessDescription?: string;
  address: {
    street_line_1: string;
    street_line_2?: string;
    city: string;
    subdivision?: string;
    postal_code: string;
    country: string;
  };
  idempotencyKey: string;
};

export type RegisterExternalAccountResult = {
  providerExternalAccountId: string;
  currency: string;
  paymentRail: string;
  active: boolean;
  accountLast4: string | null;
  checkingOrSavings: string | null;
  accountName: string | null;
  bankName: string | null;
  accountOwnerName: string | null;
};

export type CreateLiquidationAddressInput = {
  customerId: string;
  externalAccountId: string;
  sourceCurrency: string;
  destinationPaymentRail: string;
  destinationCurrency: string;
  wireMessage?: string;
  idempotencyKey: string;
};

export type CreateLiquidationAddressResult = {
  providerLiquidationAddressId: string;
  evmAddress: string;
  sourceCurrency: string;
  sourceChain: string;
  destinationPaymentRail: string;
  destinationCurrency: string;
  state: string;
};
