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

export interface BankKycProvider {
  readonly provider: BankProvider;
  createKycLink(input: CreateKycLinkInput): Promise<CreateKycLinkResult>;
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
