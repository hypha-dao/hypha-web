import { pgTable, text, serial } from 'drizzle-orm/pg-core';

export const transfers = pgTable('transfers', {
  id: serial('id').primaryKey(),
  transactionHash: text('transaction_hash').notNull().unique(),
  memo: text('memo'),
});
