import {
  pgTable,
  integer,
  text,
  serial,
  boolean,
  timestamp,
  numeric,
} from 'drizzle-orm/pg-core';
import { spaces } from './space';
import { documents } from './document';
import { relations } from 'drizzle-orm';

export const tokens = pgTable('tokens', {
  id: serial('id').primaryKey(),
  agreementId: integer('agreement_id').references(() => documents.id, {
    onDelete: 'cascade',
  }),
  spaceId: integer('space_id').references(() => spaces.id),
  name: text('name').notNull(),
  symbol: text('symbol').notNull(),
  maxSupply: integer('max_supply').notNull(),
  type: text('type').notNull(),
  iconUrl: text('icon_url'),
  transferable: boolean('transferable').notNull(),
  isVotingToken: boolean('is_voting_token').notNull(),
  decayInterval: integer('decay_interval'),
  decayPercentage: integer('decay_percentage'),
  createdAt: timestamp('created_at').defaultNow(),
  address: text('address'),
  agreementWeb3Id: integer('agreement_web3_id'),
  referencePrice: numeric('reference_price'),
  referenceCurrency: text('reference_currency'),
});

export const tokenRelations = relations(tokens, ({ one }) => ({
  agreement: one(documents, {
    fields: [tokens.agreementId],
    references: [documents.id],
  }),
  space: one(spaces, {
    fields: [tokens.spaceId],
    references: [spaces.id],
  }),
}));
