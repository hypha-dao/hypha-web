import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { commonDateFields } from './shared';
import { spaces } from './space';

export type BankCustomerPreviousKycLink = {
  providerKycLinkId: string;
  kycLink: string | null;
  tosLink: string | null;
  kycStatus: string;
  tosStatus: string | null;
  endorsements: string[];
  archivedAt: string;
};

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
    providerKycLinkId: text('provider_kyc_link_id').notNull(),
    name: text('name').notNull(),
    contactEmail: text('contact_email').notNull(),
    endorsements: jsonb('endorsements').$type<string[]>().notNull().default([]),
    kycStatus: text('kyc_status').notNull(),
    tosStatus: text('tos_status'),
    kycLink: text('kyc_link'),
    tosLink: text('tos_link'),
    previousKycLinks: jsonb('previous_kyc_links')
      .$type<BankCustomerPreviousKycLink[]>()
      .notNull()
      .default([]),
    idempotencyKey: text('idempotency_key').notNull(),
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
