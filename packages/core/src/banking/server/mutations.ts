import type { DbConfig } from '../../common/server/types';
import type { BankEntityType, BankProvider } from '../types';
import { eq } from 'drizzle-orm';

import {
  bankCustomers,
  type BankCustomer,
  type BankCustomerRequestedRails,
} from '@hypha-platform/storage-postgres';

export type InsertBankCustomerInput = {
  entityType: BankEntityType;
  provider: BankProvider;
  providerCustomerId: string | null;
  providerKycLinkId: string;
  requestedRails: BankCustomerRequestedRails;
} & (
  | { spaceId: number; personId?: undefined }
  | { spaceId?: undefined; personId: number }
);

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
  providerCustomerId?: string | null;
  providerKycLinkId?: string;
  requestedRails?: BankCustomerRequestedRails;
};

export const updateBankCustomer = async (
  input: UpdateBankCustomerInput,
  { db }: DbConfig,
): Promise<BankCustomer> => {
  const patch: Partial<typeof bankCustomers.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (input.providerCustomerId !== undefined) {
    patch.providerCustomerId = input.providerCustomerId;
  }
  if (input.providerKycLinkId !== undefined) {
    patch.providerKycLinkId = input.providerKycLinkId;
  }
  if (input.requestedRails !== undefined) {
    patch.requestedRails = input.requestedRails;
  }

  const [row] = await db
    .update(bankCustomers)
    .set(patch)
    .where(eq(bankCustomers.id, input.id))
    .returning();

  if (!row) {
    throw new Error('Failed to update bank customer');
  }

  return row;
};
