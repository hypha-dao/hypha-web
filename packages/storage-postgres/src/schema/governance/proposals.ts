import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { commonDateFields } from '../shared';
import { people } from '../people';
import { documents } from './document';
import { voteTypeEnum } from './types';

export const documentProposals = pgTable('document_proposals', {
  ...commonDateFields,
  documentId: integer('document_id')
    .notNull()
    .references(() => documents.id),
  votingStartsAt: timestamp('voting_starts_at').notNull(),
  votingEndsAt: timestamp('voting_ends_at').notNull(),
  minVotesRequired: integer('min_votes_required').notNull(),
});

export const documentVotes = pgTable(
  'document_votes',
  {
    ...commonDateFields,
    proposalId: integer('proposal_id')
      .notNull()
      .references(() => documentProposals.id),
    voterId: integer('voter_id')
      .notNull()
      .references(() => people.id),
    vote: voteTypeEnum('vote').notNull(),
    comment: text('comment'),
  },
  (table) => [
    {
      // Ensure one vote per person per proposal
      uniqueVoterProposal: unique().on(table.proposalId, table.voterId),
    },
  ],
);

export type DocumentProposal = InferSelectModel<typeof documentProposals>;
export type NewDocumentProposal = InferInsertModel<typeof documentProposals>;

export type DocumentVote = InferSelectModel<typeof documentVotes>;
export type NewDocumentVote = InferInsertModel<typeof documentVotes>;
