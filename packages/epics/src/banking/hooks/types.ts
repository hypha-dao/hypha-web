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
