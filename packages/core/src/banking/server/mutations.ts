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
  /**
   * Pass `null` to release/revoke an in-flight confirmation claim (resend does this, D3 — an
   * outstanding confirmation attempt is revoked the same instant a new link is issued, not only
   * future clicks of the old one), or omit to leave as-is. Never set to a value here — only
   * `claimBankCustomerForConfirmation` sets it, atomically.
   */
  confirmingNonce?: null;
};

/**
 * Atomically claims a pending row for confirmation (#2288): sets `confirming_nonce` only if
 * `jwt_nonce` still matches `expectedNonce` *and* no other confirmation already has it claimed
 * (`confirming_nonce IS NULL`). Returns `null` if either fails (already claimed by a concurrent
 * confirmation, or the link was rotated by a resend) — the caller must treat that as an invalid
 * confirmation rather than proceeding to call the provider twice for the same row.
 *
 * Deliberately a separate column from `jwt_nonce` rather than clearing `jwt_nonce` itself: a
 * resend needs to be able to revoke *this specific in-flight attempt* (by clearing
 * `confirming_nonce` via `updateBankCustomer`) independently of rotating `jwt_nonce` to the next
 * link, and the attempt's own final write (`finalizeClaimedBankCustomer`) needs something stable
 * to condition on that a concurrent resend hasn't already repurposed.
 */
export const claimBankCustomerForConfirmation = async (
  { id, expectedNonce }: { id: number; expectedNonce: string },
  { db }: DbConfig,
): Promise<BankCustomer | null> => {
  const [row] = await db
    .update(bankCustomers)
    .set({ confirmingNonce: expectedNonce, updatedAt: new Date() })
    .where(
      and(
        eq(bankCustomers.id, id),
        eq(bankCustomers.jwtNonce, expectedNonce),
        isNull(bankCustomers.confirmingNonce),
      ),
    )
    .returning();

  return row ?? null;
};

export type FinalizeClaimedBankCustomerInput = {
  id: number;
  /** Must match the row's current `confirming_nonce` — see `claimBankCustomerForConfirmation`. */
  expectedConfirmingNonce: string;
  providerCustomerId: string | null;
  providerKycLinkId: string;
  requestedRails: BankCustomerRequestedRails;
};

/**
 * Persists a successful provider call for a claimed row (#2288 confirm path) — conditioned on
 * `confirming_nonce` still matching, not just the row id. Returns `null` if a resend cleared the
 * claim in the meantime (superseded): the caller must not report success in that case, even though
 * the provider call itself already succeeded — see `confirmBankEmail`.
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
      jwtNonce: null,
      confirmingNonce: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(bankCustomers.id, input.id),
        eq(bankCustomers.confirmingNonce, input.expectedConfirmingNonce),
      ),
    )
    .returning();

  return row ?? null;
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
  if (input.confirmingNonce !== undefined) {
    patch.confirmingNonce = input.confirmingNonce;
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
