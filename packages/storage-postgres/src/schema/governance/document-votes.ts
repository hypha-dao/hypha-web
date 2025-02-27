import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { pgTable, integer, text, unique, pgEnum } from 'drizzle-orm/pg-core';
import { people } from '../people';
import { commonDateFields } from '../shared';
import { documentProposals } from './document-proposals';
import { Vote } from './types';

export const voteTypeEnum = pgEnum('vote_type', [
  Vote.YES,
  Vote.NO,
  Vote.ABSTAIN,
]);

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

export type DocumentVote = InferSelectModel<typeof documentVotes>;
export type NewDocumentVote = InferInsertModel<typeof documentVotes>;
