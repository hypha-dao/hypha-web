import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
} from 'drizzle-orm/pg-core';
import { commonDateFields } from './shared';
import { bankCustomers } from './bank-customer';

export const bankTransfers = pgTable('bank_transfers', {
  id: serial('id').primaryKey(),
  bankCustomerId: integer('bank_customer_id')
    .notNull()
    .references(() => bankCustomers.id),
  provider: text('provider').notNull(),
  providerTransferId: text('provider_transfer_id'),
  currency: text('currency').notNull(),
  paymentRail: text('payment_rail').notNull(),
  amount: text('amount'),
  depositMessage: text('deposit_message'),
  status: text('status').notNull(),
  depositInstructions: jsonb('deposit_instructions')
    .$type<Record<string, unknown>>()
    .notNull(),
  destinationAddress: text('destination_address').notNull(),
  ...commonDateFields,
});

export type BankTransfer = InferSelectModel<typeof bankTransfers>;
export type NewBankTransfer = InferInsertModel<typeof bankTransfers>;
