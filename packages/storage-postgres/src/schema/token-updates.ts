import {
  pgTable,
  integer,
  text,
  serial,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { documents } from './document';
import { relations } from 'drizzle-orm';

export const tokenUpdates = pgTable('token_updates', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id')
    .notNull()
    .references(() => documents.id, {
      onDelete: 'cascade',
    }),
  tokenAddress: text('token_address').notNull(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const tokenUpdateRelations = relations(tokenUpdates, ({ one }) => ({
  document: one(documents, {
    fields: [tokenUpdates.documentId],
    references: [documents.id],
  }),
}));
