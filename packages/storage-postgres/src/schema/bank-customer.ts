import { InferInsertModel, InferSelectModel, sql } from 'drizzle-orm';
import {
  check,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { commonDateFields } from './shared';
import { spaces } from './space';
import { people } from './people';

/** Hypha-side deposit currencies the owner requested (not provider PII). */
export type BankCustomerRequestedRails = string[];

/**
 * A Bridge (or future provider) customer, owned by exactly one subject: either a
 * space (space treasury banking) or a person (individual/profile banking). The
 * DB-level XOR check guarantees exactly one owner per row.
 */
export const bankCustomers = pgTable(
  'bank_customers',
  {
    id: serial('id').primaryKey(),
    spaceId: integer('space_id').references(() => spaces.id),
    personId: integer('person_id').references(() => people.id),
    entityType: text('entity_type').notNull(),
    provider: text('provider').notNull(),
    providerCustomerId: text('provider_customer_id'),
    /**
     * Nullable: unset while an email-ownership confirmation is pending (#2288) — no Bridge
     * KYC link exists yet at that point.
     */
    providerKycLinkId: text('provider_kyc_link_id'),
    /**
     * The nonce a confirmation link must present (`jti` of the JWT) to be considered live for
     * this row (#2288). Set while pending; cleared to `NULL` the instant a confirmation claims the
     * row (before calling the provider) and stays `NULL` through to persisting the result — the
     * confirm path's final write is itself conditioned on this still being `NULL`
     * (`finalizeClaimedBankCustomer`), so a resend racing in in the middle (which always sets a
     * fresh non-null value, instantly revoking whatever was claimed) makes that write a no-op
     * instead of silently completing a stale confirmation. See `bank-onboarding-confirmation.ts`.
     */
    jwtNonce: uuid('jwt_nonce'),
    requestedRails: jsonb('requested_rails')
      .$type<BankCustomerRequestedRails>()
      .notNull()
      .default([]),
    ...commonDateFields,
  },
  (table) => [
    uniqueIndex('bank_customers_space_provider_unique').on(
      table.spaceId,
      table.provider,
    ),
    uniqueIndex('bank_customers_person_provider_unique').on(
      table.personId,
      table.provider,
    ),
    uniqueIndex('bank_customers_jwt_nonce_unique').on(table.jwtNonce),
    check(
      'bank_customers_owner_xor',
      sql`(${table.spaceId} IS NOT NULL) <> (${table.personId} IS NOT NULL)`,
    ),
  ],
);

export type BankCustomer = InferSelectModel<typeof bankCustomers>;
export type NewBankCustomer = InferInsertModel<typeof bankCustomers>;
