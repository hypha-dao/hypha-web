import {
  index,
  integer,
  numeric,
  pgTable,
  serial,
  smallint,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { commonDateFields } from './shared';
import { coherences } from './coherence';
import { people } from './people';

/**
 * One row per person per signal. Voting power is snapshotted at vote time from
 * the same on-chain voting power source the space uses for proposals
 * (raw units — wei-scale for token sources, whole votes for 1m1v).
 */
export const coherenceUpvotes = pgTable(
  'coherence_upvotes',
  {
    id: serial('id').primaryKey(),
    coherenceId: integer('coherence_id')
      .notNull()
      .references(() => coherences.id, { onDelete: 'cascade' }),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    votingPower: numeric('voting_power', { precision: 78, scale: 0 })
      .notNull()
      .$type<string>(),
    maxVotingPower: numeric('max_voting_power', { precision: 78, scale: 0 })
      .notNull()
      .$type<string>(),
    /** Display decimals of the voting power source token (0 for 1m1v, 18 for token/voice). */
    tokenDecimals: smallint('token_decimals').notNull().default(0),
    ...commonDateFields,
  },
  (table) => [
    uniqueIndex('coherence_upvotes_coherence_person_key').on(
      table.coherenceId,
      table.personId,
    ),
    index('coherence_upvotes_person_idx').on(table.personId),
  ],
);

export type CoherenceUpvote = InferSelectModel<typeof coherenceUpvotes>;
export type NewCoherenceUpvote = InferInsertModel<typeof coherenceUpvotes>;
