import type { DbConfig } from '../../common/server/types';
import type { BankEntityType, BankProvider } from '../types';
import { and, eq, isNull } from 'drizzle-orm';

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

/**
 * Atomically claims a pending row for confirmation (#2288): clears `jwt_nonce` only if it still
 * matches `expectedNonce`. Returns `null` if it doesn't (already claimed by a concurrent
 * confirmation, or rotated by a resend) — the caller must treat that as an invalid confirmation
 * rather than proceeding to call the provider twice for the same row.
 */
export const claimBankCustomerForConfirmation = async (
  { id, expectedNonce }: { id: number; expectedNonce: string },
  { db }: DbConfig,
): Promise<BankCustomer | null> => {
  const [row] = await db
    .update(bankCustomers)
    .set({ jwtNonce: null, updatedAt: new Date() })
    .where(
      and(eq(bankCustomers.id, id), eq(bankCustomers.jwtNonce, expectedNonce)),
    )
    .returning();

  return row ?? null;
};

export type FinalizeClaimedBankCustomerInput = {
  id: number;
  providerCustomerId: string | null;
  providerKycLinkId: string;
  requestedRails: BankCustomerRequestedRails;
};

/**
 * Persists a successful provider call for a claimed row (#2288 confirm path) — conditioned on
 * `jwt_nonce` still being `NULL`, i.e. still the exact state `claimBankCustomerForConfirmation`
 * left it in, not just the row id. Returns `null` if a resend rotated `jwt_nonce` to a new value in
 * the meantime (superseded): the caller must not report success in that case, even though the
 * provider call itself already succeeded — see `confirmBankEmail`. This recheck-at-write, not just
 * recheck-at-read, is the actual fix for the race: a resend arriving between the claim and this
 * write is what a plain `WHERE id = ?` write misses.
 */
export const finalizeClaimedBankCustomer = async (
  input: FinalizeClaimedBankCustomerInput,
  { db }: DbConfig,
): Promise<BankCustomer | null> => {
  const [row] = await db
    .update(bankCustomers)
    .set({
      providerCustomerId: input.providerCustomerId,
      providerKycLinkId: input.providerKycLinkId,
      requestedRails: input.requestedRails,
      updatedAt: new Date(),
    })
    .where(and(eq(bankCustomers.id, input.id), isNull(bankCustomers.jwtNonce)))
    .returning();

  return row ?? null;
};

/**
 * Releases a claim after a failed provider call (#2288 confirm path), restoring `jwt_nonce` so the
 * same link (or a resend) can retry — conditioned on `jwt_nonce` still being `NULL`, same as
 * `finalizeClaimedBankCustomer`. If a resend already rotated it in the meantime, this is a no-op:
 * restoring the *old* nonce unconditionally would silently undo that resend, the exact bug this
 * whole claim/finalize design exists to prevent, just on the failure path instead of the success
 * one.
 */
export const releaseBankCustomerClaim = async (
  { id, restoreNonce }: { id: number; restoreNonce: string },
  { db }: DbConfig,
): Promise<void> => {
  await db
    .update(bankCustomers)
    .set({ jwtNonce: restoreNonce, updatedAt: new Date() })
    .where(and(eq(bankCustomers.id, id), isNull(bankCustomers.jwtNonce)))
    .execute();
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
