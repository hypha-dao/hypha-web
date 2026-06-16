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
}
