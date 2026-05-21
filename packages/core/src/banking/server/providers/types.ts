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
  idempotencyKey: string;
};

export type ProvisionVirtualAccountResult = {
  providerVirtualAccountId: string;
  currency: string;
  paymentRail: string;
  depositInstructions: Record<string, unknown>;
  status: string;
};

export interface BankKycProvider {
  readonly provider: BankProvider;
  createKycLink(input: CreateKycLinkInput): Promise<CreateKycLinkResult>;
  provisionVirtualAccount(
    input: ProvisionVirtualAccountInput,
  ): Promise<ProvisionVirtualAccountResult>;
}
