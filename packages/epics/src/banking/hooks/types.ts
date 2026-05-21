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

export type BankProvider = 'bridge';

export type BankCustomerPublicStatus = {
  kycStatus: string;
  kycLink: string | null;
  tosLink: string | null;
  isApproved: boolean;
};

export type ProviderFormData = {
  legalName: string;
  contactEmail: string;
  endorsements?: string[];
};

export type BankOnboardingRequestInput = ProviderFormData;

export type BankOnboardingRequestResult = {
  kycStatus: string;
  kycLink: string | null;
  tosLink: string | null;
  created: boolean;
  isApproved?: boolean;
};

/** Mirrors @hypha-platform/core banking constants (client-safe duplicate). */
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
  currency: string;
  paymentRail: string;
  depositInstructions: Record<string, unknown>;
  status: string;
};

export type ProvisionVirtualAccountResult = BankVirtualAccountPublic & {
  created: boolean;
};
