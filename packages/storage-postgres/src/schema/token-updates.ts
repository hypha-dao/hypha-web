import {
  pgTable,
  integer,
  text,
  serial,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { documents } from './document';
import { relations } from 'drizzle-orm';

/**
 * Mirrors `TokenUpdateData` in `@hypha-platform/core` — keep fields aligned for DB JSON.
 * (Declared locally to avoid a workspace package cycle: core → storage-postgres → core.)
 */
export type TokenUpdateDataJson = {
  name?: string;
  symbol?: string;
  maxSupply?: number;
  maxSupplyTypeValue?: 'immutable' | 'updatable';
  type?: string;
  iconUrl?: string;
  transferable?: boolean;
  isVotingToken?: boolean;
  decayInterval?: number;
  decayPercentage?: number;
  referencePrice?: number;
  referenceCurrency?: string;
  archiveToken?: boolean;
  enableProposalAutoMinting?: boolean;
  enableAdvancedTransferControls?: boolean;
  useTransferWhitelist?: boolean;
  useReceiveWhitelist?: boolean;
  transferWhitelist?: unknown;
};

export const tokenUpdates = pgTable(
  'token_updates',
  {
    id: serial('id').primaryKey(),
    documentId: integer('document_id')
      .notNull()
      .references(() => documents.id, {
        onDelete: 'cascade',
      }),
    tokenAddress: text('token_address').notNull(),
    data: jsonb('data').$type<TokenUpdateDataJson>().notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('token_updates_document_id_idx').on(table.documentId),
    index('token_updates_token_address_idx').on(table.tokenAddress),
  ],
);

export const tokenUpdateRelations = relations(tokenUpdates, ({ one }) => ({
  document: one(documents, {
    fields: [tokenUpdates.documentId],
    references: [documents.id],
  }),
}));
