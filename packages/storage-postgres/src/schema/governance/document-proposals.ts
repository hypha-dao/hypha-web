import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, pgTable, timestamp } from 'drizzle-orm/pg-core';
import { commonDateFields } from '../shared';
import { documents } from './document';

export const documentProposals = pgTable('document_proposals', {
  ...commonDateFields,
  documentId: integer('document_id')
    .notNull()
    .references(() => documents.id),
  minVotesRequired: integer('min_votes_required').notNull(),
});

export type DocumentProposal = InferSelectModel<typeof documentProposals>;
export type NewDocumentProposal = InferInsertModel<typeof documentProposals>;
