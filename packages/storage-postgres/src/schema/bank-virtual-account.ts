import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { commonDateFields } from './shared';
import { bankCustomers } from './bank-customer';

export const bankVirtualAccounts = pgTable(
  'bank_virtual_accounts',
  {
    id: serial('id').primaryKey(),
    bankCustomerId: integer('bank_customer_id')
      .notNull()
      .references(() => bankCustomers.id),
    provider: text('provider').notNull(),
    providerVirtualAccountId: text('provider_virtual_account_id'),
    currency: text('currency').notNull(),
    paymentRail: text('payment_rail').notNull(),
    depositInstructions: jsonb('deposit_instructions')
      .$type<Record<string, unknown>>()
      .notNull(),
    destinationAddress: text('destination_address').notNull(),
    status: text('status').notNull(),
    isApproved: boolean('is_approved').notNull().default(false),
    ...commonDateFields,
  },
  (table) => [
    uniqueIndex('bank_virtual_accounts_customer_currency_rail_unique').on(
      table.bankCustomerId,
      table.currency,
      table.paymentRail,
    ),
  ],
);

export type BankVirtualAccount = InferSelectModel<typeof bankVirtualAccounts>;
export type NewBankVirtualAccount = InferInsertModel<
  typeof bankVirtualAccounts
>;
