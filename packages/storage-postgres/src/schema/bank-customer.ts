import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
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

/** Hypha-side deposit currencies the space requested (not provider PII). */
export type BankCustomerRequestedRails = string[];

export const bankCustomers = pgTable(
  'bank_customers',
  {
    id: serial('id').primaryKey(),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id),
    entityType: text('entity_type').notNull(),
    provider: text('provider').notNull(),
    providerCustomerId: text('provider_customer_id'),
    providerKycLinkId: text('provider_kyc_link_id'),
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
  ],
);

export type BankCustomer = InferSelectModel<typeof bankCustomers>;
export type NewBankCustomer = InferInsertModel<typeof bankCustomers>;
