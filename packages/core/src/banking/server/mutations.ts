import type { DbConfig } from '../../common/server/types';
import type { BankEntityType, BankProvider } from '../types';
import { eq } from 'drizzle-orm';

import {
  bankCustomers,
  bankTransfers,
  bankVirtualAccounts,
  type BankCustomer,
  type BankTransfer,
  type BankVirtualAccount,
} from '@hypha-platform/storage-postgres';

export type InsertBankCustomerInput = {
  spaceId: number;
  entityType: BankEntityType;
  provider: BankProvider;
  providerCustomerId: string | null;
  providerKycLinkId: string;
  name: string;
  contactEmail: string;
  endorsements: string[];
  kycStatus: string;
  tosStatus: string | null;
  kycLink: string | null;
  tosLink: string | null;
  idempotencyKey: string;
};

export const insertBankCustomer = async (
  input: InsertBankCustomerInput,
  { db }: DbConfig,
): Promise<BankCustomer> => {
  const [row] = await db.insert(bankCustomers).values(input).returning();

  if (!row) {
    throw new Error('Failed to insert bank customer');
  }

  return row;
};

export type UpdateBankCustomerInput = {
  id: number;
  kycStatus?: string;
  providerCustomerId?: string | null;
};

export const updateBankCustomer = async (
  { id, kycStatus, providerCustomerId }: UpdateBankCustomerInput,
  { db }: DbConfig,
): Promise<BankCustomer> => {
  const patch: Partial<typeof bankCustomers.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (kycStatus !== undefined) {
    patch.kycStatus = kycStatus;
  }

  if (providerCustomerId !== undefined) {
    patch.providerCustomerId = providerCustomerId;
  }

  const [row] = await db
    .update(bankCustomers)
    .set(patch)
    .where(eq(bankCustomers.id, id))
    .returning();

  if (!row) {
    throw new Error('Failed to update bank customer');
  }

  return row;
};

export type InsertBankVirtualAccountInput = {
  bankCustomerId: number;
  provider: BankProvider;
  providerVirtualAccountId: string;
  currency: string;
  paymentRail: string;
  depositInstructions: Record<string, unknown>;
  destinationAddress: string;
  status: string;
};

export const insertBankVirtualAccount = async (
  input: InsertBankVirtualAccountInput,
  { db }: DbConfig,
): Promise<BankVirtualAccount> => {
  const [row] = await db.insert(bankVirtualAccounts).values(input).returning();

  if (!row) {
    throw new Error('Failed to insert bank virtual account');
  }

  return row;
};

export type InsertBankTransferInput = {
  bankCustomerId: number;
  provider: BankProvider;
  providerTransferId: string;
  currency: string;
  paymentRail: string;
  amount: string | null;
  depositMessage: string;
  status: string;
  depositInstructions: Record<string, unknown>;
  destinationAddress: string;
};

export const insertBankTransfer = async (
  input: InsertBankTransferInput,
  { db }: DbConfig,
): Promise<BankTransfer> => {
  const [row] = await db.insert(bankTransfers).values(input).returning();

  if (!row) {
    throw new Error('Failed to insert bank transfer');
  }

  return row;
};

export type UpdateBankVirtualAccountInput = {
  id: number;
  providerVirtualAccountId?: string | null;
  currency?: string;
  paymentRail?: string;
  depositInstructions?: Record<string, unknown>;
  destinationAddress?: string;
  status?: string;
};

export const updateBankVirtualAccount = async (
  input: UpdateBankVirtualAccountInput,
  { db }: DbConfig,
): Promise<BankVirtualAccount> => {
  const {
    id,
    providerVirtualAccountId,
    currency,
    paymentRail,
    depositInstructions,
    destinationAddress,
    status,
  } = input;

  const patch: Partial<typeof bankVirtualAccounts.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (providerVirtualAccountId !== undefined) {
    patch.providerVirtualAccountId = providerVirtualAccountId;
  }
  if (currency !== undefined) {
    patch.currency = currency;
  }
  if (paymentRail !== undefined) {
    patch.paymentRail = paymentRail;
  }
  if (depositInstructions !== undefined) {
    patch.depositInstructions = depositInstructions;
  }
  if (destinationAddress !== undefined) {
    patch.destinationAddress = destinationAddress;
  }
  if (status !== undefined) {
    patch.status = status;
  }

  const [row] = await db
    .update(bankVirtualAccounts)
    .set(patch)
    .where(eq(bankVirtualAccounts.id, id))
    .returning();

  if (!row) {
    throw new Error('Failed to update bank virtual account');
  }

  return row;
};

export type UpdateBankTransferInput = {
  id: number;
  providerTransferId?: string | null;
  status?: string;
  depositInstructions?: Record<string, unknown>;
  depositMessage?: string | null;
  amount?: string | null;
  currency?: string;
  paymentRail?: string;
};

export const updateBankTransfer = async (
  input: UpdateBankTransferInput,
  { db }: DbConfig,
): Promise<BankTransfer> => {
  const patch: Partial<typeof bankTransfers.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.status !== undefined) {
    patch.status = input.status;
  }
  if (input.depositInstructions !== undefined) {
    patch.depositInstructions = input.depositInstructions;
  }
  if (input.depositMessage !== undefined) {
    patch.depositMessage = input.depositMessage;
  }
  if (input.providerTransferId !== undefined) {
    patch.providerTransferId = input.providerTransferId;
  }
  if (input.amount !== undefined) {
    patch.amount = input.amount;
  }
  if (input.currency !== undefined) {
    patch.currency = input.currency;
  }
  if (input.paymentRail !== undefined) {
    patch.paymentRail = input.paymentRail;
  }

  const [row] = await db
    .update(bankTransfers)
    .set(patch)
    .where(eq(bankTransfers.id, input.id))
    .returning();

  if (!row) {
    throw new Error('Failed to update bank transfer');
  }

  return row;
};
