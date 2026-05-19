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
