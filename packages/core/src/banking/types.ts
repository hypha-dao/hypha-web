export type BankProvider = 'bridge';

export type BankEntityType = 'business' | 'individual';

export type BankOnboardingResult = {
  kycStatus: string;
  kycLink: string | null;
  tosLink: string | null;
  legalName: string;
  contactEmail: string;
  endorsements: string[];
  provider: BankProvider;
  created: boolean;
  spaceTitle: string;
  requesterSlug: string | null;
};

export type RequestSpaceBankOnboardingInput = {
  spaceSlug: string;
  authToken: string;
  legalName: string;
  contactEmail: string;
  endorsements?: string[];
};

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

export type ProvisionSpaceBankVirtualAccountResult = BankVirtualAccountPublic & {
  created: boolean;
};

export type RequestSpaceBankVirtualAccountInput = {
  spaceSlug: string;
  authToken: string;
  currency: string;
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

export type CreateSpaceBankTransferResult = BankTransferPublic;

export type RequestSpaceBankTransferInput = {
  spaceSlug: string;
  authToken: string;
  currency: string;
  amount?: string;
  legalName?: string;
  contactEmail?: string;
  endorsements?: string[];
  redirectUri?: string;
};

export type RequestSpaceBankVirtualAccountsInput = {
  spaceSlug: string;
  authToken: string;
  currencies: string[];
  legalName?: string;
  contactEmail?: string;
  endorsements?: string[];
  redirectUri?: string;
};

export type SyncSpaceBankingFromBridgeResult = {
  kycStatus: string;
  isApproved: boolean;
  transfersSynced: number;
  transfers: BankTransferPublic[];
};
