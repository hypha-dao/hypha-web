import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { pgTable, integer, text, unique } from 'drizzle-orm/pg-core';
import { people } from '../people';
import { commonDateFields } from '../shared';
import { documentProposals } from './proposals';
import { voteTypeEnum } from './types';

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
