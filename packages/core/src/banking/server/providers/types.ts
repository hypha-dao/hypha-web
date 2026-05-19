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
  tosStatus: string | null;
  kycLink: string;
  tosLink: string | null;
};

export interface BankKycProvider {
  readonly provider: BankProvider;
  createKycLink(input: CreateKycLinkInput): Promise<CreateKycLinkResult>;
}
