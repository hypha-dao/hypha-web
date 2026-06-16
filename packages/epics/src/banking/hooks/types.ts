export type BankPendingUbo = {
  id: string;
  email: string | null;
};

export type BankPendingRequirements = {
  sofQuestionnaire: { link: string } | null;
  pendingUbos: BankPendingUbo[];
};

export const BANK_KYC_STATUSES = [
  'not_started',
  'incomplete',
  'awaiting_questionnaire',
  'awaiting_ubo',
  'under_review',
  'approved',
  'rejected',
  'paused',
  'offboarded',
] as const;

export type BankKycStatus = (typeof BANK_KYC_STATUSES)[number];

export type { BankProvider } from '@hypha-platform/core/client';

export type BankValidationAction = {
  type: 'link';
  url: string;
};

export type BankVerificationProcedurePublic = {
  key: string;
  status: string | null;
  isComplete: boolean;
  action?: BankValidationAction;
  linkDisabled?: boolean;
  /** @deprecated use action.url */
  link?: string | null;
};

export type BankCurrencyOperationalStatus =
  | 'active'
  | 'approved'
  | 'pending'
  | 'not_approved'
  | 'not_requested'
  | 'not_opened';

export type BankCurrencyPublicStatus = {
  currency: string;
  endorsement: string;
  endorsementStatus: string | null;
  virtualAccountId: string | null;
  isApproved: boolean;
  operationalStatus: BankCurrencyOperationalStatus;
  validation?: BankVerificationProcedurePublic;
};

export type BankRailPublicStatus = {
  railKey: string;
  currency: string;
  paymentRail: string;
  endorsement: string;
  endorsementStatus: string | null;
  operationalStatus: BankCurrencyOperationalStatus;
  validation: BankVerificationProcedurePublic;
  hasVirtualAccount: boolean;
};

export type BankEndorsementPublicStatus = {
  endorsement: string;
  endorsementStatus: string | null;
  operationalStatus: BankCurrencyOperationalStatus;
  validation: BankVerificationProcedurePublic;
};

export type BankCustomerPublicStatus = {
  hasCustomer?: boolean;
  isApproved: boolean;
  approvalRegistered: boolean;
  procedures: {
    tos: BankVerificationProcedurePublic;
    kyc: BankVerificationProcedurePublic;
  };
  currencyStatuses: BankCurrencyPublicStatus[];
  endorsementStatuses: BankEndorsementPublicStatus[];
  railStatuses: BankRailPublicStatus[];
  requestedRails: string[];
  pendingRequirements?: BankPendingRequirements;
};

export type ProviderFormData = {
  legalName: string;
  contactEmail: string;
  requestedRails?: string[];
};

export type BankOnboardingRequestInput = ProviderFormData;

export type BankOnboardingRequestResult = {
  kycLink: string | null;
  tosLink: string | null;
  created: boolean;
  procedures: BankCustomerPublicStatus['procedures'];
};

export const BANK_VIRTUAL_ACCOUNT_CORRIDORS = [
  { currency: 'eur', paymentRail: 'sepa' },
  { currency: 'usd', paymentRail: 'ach' },
  { currency: 'gbp', paymentRail: 'faster_payments' },
  { currency: 'mxn', paymentRail: 'spei' },
  { currency: 'brl', paymentRail: 'pix' },
  { currency: 'cop', paymentRail: 'cop' },
] as const;

export type BankVirtualAccountCurrency =
  (typeof BANK_VIRTUAL_ACCOUNT_CORRIDORS)[number]['currency'];

export type BankVirtualAccountPublic = {
  id: string;
  currency: string;
  paymentRail: string;
  depositInstructions: Record<string, unknown>;
  destinationAddress: string;
  status: string;
  createdAt: string | null;
};

export type PaginatedBankVirtualAccounts = {
  accounts: BankVirtualAccountPublic[];
  hasMore: boolean;
  nextCursor: string | null;
};

export type CreateBankAccountResult = {
  account: BankVirtualAccountPublic;
};

export type BankTransferPublic = {
  id: string;
  currency: string;
  paymentRail: string;
  amount: string | null;
  depositMessage: string | null;
  status: string;
  depositInstructions: Record<string, unknown>;
  destinationAddress: string;
  createdAt: string;
};

export type PaginatedBankTransfers = {
  transfers: BankTransferPublic[];
  hasMore: boolean;
  nextCursor: string | null;
};

export type BankAddAccountRailOption = {
  railKey: string;
  currency: string;
  paymentRail: string;
  endorsement: string;
  operationalStatus: BankCurrencyOperationalStatus;
  validation: BankVerificationProcedurePublic;
  hasVirtualAccount: boolean;
  destinationCurrencies: string[];
  defaultDestinationCurrency: string;
};

export type BankTransferRailOption = {
  railKey: string;
  currency: string;
  paymentRail: string;
  endorsement: string;
  operationalStatus: BankCurrencyOperationalStatus;
  validation: BankVerificationProcedurePublic;
  destinationCurrencies: string[];
  defaultDestinationCurrency: string;
};

export type SyncBankingResult = {
  isApproved: boolean;
  procedures: BankCustomerPublicStatus['procedures'];
  railStatuses: BankRailPublicStatus[];
};
