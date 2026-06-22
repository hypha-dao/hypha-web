export type BankProvider = 'bridge';

export type BankPendingUbo = {
  id: string;
  email: string | null;
};

export type BankPendingRequirements = {
  /** Link to the Persona-hosted SoF questionnaire, or null if not constructable. */
  sofQuestionnaire: { link: string } | null;
  /** UBOs whose required fields are still missing. */
  pendingUbos: BankPendingUbo[];
};

export type BankEntityType = 'business' | 'individual';

export type BankValidationAction = {
  type: 'link';
  url: string;
};

export type BankValidationRequirement = {
  key: string;
  status: string | null;
  isComplete: boolean;
  action?: BankValidationAction;
  linkDisabled?: boolean;
};

export type BankRailOperationalStatus =
  | 'approved'
  | 'pending'
  | 'rejected'
  | 'not_approved'
  | 'not_requested';

export type BankRailPublicStatus = {
  railKey: string;
  currency: string;
  paymentRail: string;
  endorsement: string;
  endorsementStatus: string | null;
  operationalStatus: BankRailOperationalStatus;
  validation: BankValidationRequirement;
  hasVirtualAccount: boolean;
};

/** Bridge KYC endorsement (base, sepa, spei, …) — one row per endorsement in settings UI. */
export type BankEndorsementPublicStatus = {
  endorsement: string;
  endorsementStatus: string | null;
  operationalStatus: BankRailOperationalStatus;
  validation: BankValidationRequirement;
};

export type BankOnboardingResult = {
  provider: BankProvider;
  created: boolean;
  spaceTitle: string;
  requesterSlug: string | null;
  kycLink: string | null;
  tosLink: string | null;
  procedures: {
    tos: BankValidationRequirement;
    kyc: BankValidationRequirement;
  };
};

export type RequestSpaceBankOnboardingInput = {
  spaceSlug: string;
  authToken: string;
  legalName: string;
  contactEmail: string;
  requestedRails?: string[];
  redirectUri?: string;
};

export type BankVirtualAccountPublic = {
  id: string;
  currency: string;
  paymentRail: string;
  depositInstructions: Record<string, unknown>;
  destinationAddress: string;
  status: string;
  createdAt: string | null;
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

export type PaginatedBankVirtualAccounts = {
  accounts: BankVirtualAccountPublic[];
  hasMore: boolean;
  nextCursor: string | null;
};

export type ProvisionSpaceBankVirtualAccountResult = BankVirtualAccountPublic;

export type RequestSpaceBankVirtualAccountInput = {
  spaceSlug: string;
  authToken: string;
  currency: string;
  destinationCurrency?: string;
};

export type CreateSpaceBankTransferResult = BankTransferPublic;

export type RequestSpaceBankTransferInput = {
  spaceSlug: string;
  authToken: string;
  railKey?: string;
  corridorKey?: string;
  currency?: string;
  amount?: string;
  destinationCurrency?: string;
  redirectUri?: string;
  /** Client-supplied idempotency key; falls back to a random UUID server-side. */
  idempotencyKey?: string;
};

export type CreateSpaceBankVirtualAccountInput = {
  spaceSlug: string;
  authToken: string;
  currency: string;
  destinationCurrency?: string;
};

export type CreateSpaceBankVirtualAccountResult = {
  account: BankVirtualAccountPublic;
};

export type RequestEndorsementKycInput = {
  spaceSlug: string;
  authToken: string;
  endorsement: string;
};

export type SyncSpaceBankingFromBridgeResult = {
  isApproved: boolean;
  procedures: {
    tos: BankValidationRequirement;
    kyc: BankValidationRequirement;
  };
  railStatuses: BankRailPublicStatus[];
};

export type ListBankTransfersInput = {
  spaceSlug: string;
  limit?: number;
  startingAfter?: string;
  endingBefore?: string;
};

export type ListBankVirtualAccountsInput = {
  spaceSlug: string;
  limit?: number;
  startingAfter?: string;
};

export type BankPayoutAccountPublic = {
  id: string;
  externalAccountId: string;
  liquidationAddressId: string;
  evmAddress: string;
  sourceCurrency: string;
  sourceChain: string;
  destinationCurrency: string;
  paymentRail: string;
  accountLast4: string | null;
  checkingOrSavings: string | null;
  accountName: string | null;
  bankName: string | null;
  accountOwnerName: string | null;
  status: string;
  createdAt: string | null;
};

export type PaginatedBankPayoutAccounts = {
  accounts: BankPayoutAccountPublic[];
  hasMore: boolean;
  nextCursor: string | null;
};

export type ListBankPayoutAccountsInput = {
  spaceSlug: string;
  limit?: number;
  startingAfter?: string;
};

export type CreateSpaceBankPayoutAccountInput = {
  spaceSlug: string;
  authToken: string;
  railKey: string;
  sourceCurrency: string;
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
  wireMessage?: string;
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
};

export type CreateSpaceBankPayoutAccountResult = {
  account: BankPayoutAccountPublic;
};

export type BankAddAccountRailOption = {
  railKey: string;
  currency: string;
  paymentRail: string;
  endorsement: string;
  operationalStatus: BankRailOperationalStatus;
  validation: BankValidationRequirement;
  hasVirtualAccount: boolean;
  destinationCurrencies: string[];
  defaultDestinationCurrency: string;
};

export type BankTransferRailOption = {
  railKey: string;
  currency: string;
  paymentRail: string;
  endorsement: string;
  operationalStatus: BankRailOperationalStatus;
  validation: BankValidationRequirement;
  destinationCurrencies: string[];
  defaultDestinationCurrency: string;
};
