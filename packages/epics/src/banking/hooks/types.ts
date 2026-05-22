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

export type BankVerificationProcedurePublic = {
  status: string | null;
  isComplete: boolean;
  link: string | null;
  linkDisabled: boolean;
};

export type BankCustomerPublicStatus = {
  kycStatus: string;
  tosStatus: string | null;
  kycLink: string | null;
  tosLink: string | null;
  isApproved: boolean;
  approvalRegistered: boolean;
  procedures: {
    tos: BankVerificationProcedurePublic;
    kyc: BankVerificationProcedurePublic;
  };
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

export type BankOperationLifecycle =
  | 'pending_kyb'
  | 'pending_activation'
  | 'active';

export type BankVirtualAccountPublic = {
  id: number;
  currency: string;
  paymentRail: string;
  depositInstructions: Record<string, unknown>;
  status: string;
  lifecycle: BankOperationLifecycle;
  canActivate: boolean;
  canContinueVerification: boolean;
};

export type ProvisionVirtualAccountResult = BankVirtualAccountPublic & {
  created: boolean;
};

export type BankTransferPublic = {
  id: number;
  currency: string;
  paymentRail: string;
  amount: string | null;
  depositMessage: string | null;
  status: string;
  depositInstructions: Record<string, unknown>;
  createdAt: string;
  lifecycle: BankOperationLifecycle;
  canActivate: boolean;
  canContinueVerification: boolean;
};

export type SyncBankingResult = {
  kycStatus: string;
  isApproved: boolean;
  transfersSynced: number;
  transfers: BankTransferPublic[];
};
