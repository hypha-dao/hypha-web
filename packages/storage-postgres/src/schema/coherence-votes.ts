import {
  check,
  integer,
  pgTable,
  serial,
  smallint,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { commonDateFields } from './shared';
import { coherences } from './coherence';
import { people } from './people';

export const coherenceVotes = pgTable(
  'coherence_votes',
  {
    id: serial('id').primaryKey(),
    coherenceId: integer('coherence_id')
      .notNull()
      .references(() => coherences.id, { onDelete: 'cascade' }),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    /** +1 upvote, -1 downvote */
    value: smallint('value').notNull(),
    ...commonDateFields,
  },
  (table) => [
    uniqueIndex('coherence_votes_coherence_person_uidx').on(
      table.coherenceId,
      table.personId,
    ),
    check('coherence_votes_value_check', sql`${table.value} IN (-1, 1)`),
  ],
);

export type CoherenceVote = InferSelectModel<typeof coherenceVotes>;
export type NewCoherenceVote = InferInsertModel<typeof coherenceVotes>;
