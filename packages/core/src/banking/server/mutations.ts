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
  /** Null while an email-ownership confirmation is pending (#2288) — no KYC link exists yet. */
  providerCustomerId: string | null;
  providerKycLinkId: string | null;
  /** Set only while a confirmation is pending; unset (undefined) for a direct/bypass create. */
  jwtNonce?: string;
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
  /** Pass `null` to clear (confirmation finalized), a uuid to rotate (resend, D3), or omit to leave as-is. */
  jwtNonce?: string | null;
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
  if (input.jwtNonce !== undefined) {
    patch.jwtNonce = input.jwtNonce;
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
