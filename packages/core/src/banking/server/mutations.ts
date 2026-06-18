import type { DbConfig } from '../../common/server/types';
import type { BankEntityType, BankProvider } from '../types';
import { eq } from 'drizzle-orm';

import {
  bankCustomers,
  type BankCustomer,
  type BankCustomerRequestedRails,
} from '@hypha-platform/storage-postgres';

export type InsertBankCustomerInput = {
  spaceId: number;
  entityType: BankEntityType;
  provider: BankProvider;
  providerCustomerId: string | null;
  providerKycLinkId: string;
  requestedRails: BankCustomerRequestedRails;
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

export type InsertPendingBankCustomerInput = {
  spaceId: number;
  entityType: BankEntityType;
  provider: BankProvider;
  jwtNonce: string;
  requestedRails: BankCustomerRequestedRails;
};

export const insertPendingBankCustomer = async (
  input: InsertPendingBankCustomerInput,
  { db }: DbConfig,
): Promise<BankCustomer> => {
  const [row] = await db
    .insert(bankCustomers)
    .values({
      spaceId: input.spaceId,
      entityType: input.entityType,
      provider: input.provider,
      jwtNonce: input.jwtNonce,
      requestedRails: input.requestedRails,
      providerKycLinkId: null,
      providerCustomerId: null,
    })
    .returning();

  if (!row) {
    throw new Error('Failed to insert pending bank customer');
  }

  return row;
};

export type RotatePendingBankCustomerNonceInput = {
  id: number;
  jwtNonce: string;
  requestedRails?: BankCustomerRequestedRails;
};

export const rotatePendingBankCustomerNonce = async (
  input: RotatePendingBankCustomerNonceInput,
  { db }: DbConfig,
): Promise<BankCustomer> => {
  const patch: Partial<typeof bankCustomers.$inferInsert> = {
    jwtNonce: input.jwtNonce,
    updatedAt: new Date(),
  };

  if (input.requestedRails !== undefined) {
    patch.requestedRails = input.requestedRails;
  }

  const [row] = await db
    .update(bankCustomers)
    .set(patch)
    .where(eq(bankCustomers.id, input.id))
    .returning();

  if (!row) {
    throw new Error('Failed to rotate pending bank customer nonce');
  }

  return row;
};

export type UpdateBankCustomerWithKycLinkInput = {
  id: number;
  providerKycLinkId: string;
  providerCustomerId: string | null;
  requestedRails?: BankCustomerRequestedRails;
};

export const updateBankCustomerWithKycLink = async (
  input: UpdateBankCustomerWithKycLinkInput,
  { db }: DbConfig,
): Promise<BankCustomer> => {
  const patch: Partial<typeof bankCustomers.$inferInsert> = {
    providerKycLinkId: input.providerKycLinkId,
    providerCustomerId: input.providerCustomerId,
    jwtNonce: null,
    updatedAt: new Date(),
  };

  if (input.requestedRails !== undefined) {
    patch.requestedRails = input.requestedRails;
  }

  const [row] = await db
    .update(bankCustomers)
    .set(patch)
    .where(eq(bankCustomers.id, input.id))
    .returning();

  if (!row) {
    throw new Error('Failed to update bank customer with KYC link');
  }

  return row;
};
