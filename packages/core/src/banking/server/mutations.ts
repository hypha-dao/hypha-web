import type { DbConfig } from '../../common/server/types';
import type { BankEntityType, BankProvider } from '../types';
import { eq } from 'drizzle-orm';

import {
  bankCustomers,
  bankVirtualAccounts,
  type BankCustomer,
  type BankVirtualAccount,
} from '@hypha-platform/storage-postgres';

export type InsertBankCustomerInput = {
  spaceId: number;
  adminPersonId: number;
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
