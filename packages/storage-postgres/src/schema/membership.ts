import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { pgTable, integer, uniqueIndex } from 'drizzle-orm/pg-core';
import { commonDateFields } from './shared';
import { people } from './people';
import { spaces } from './space';

export const memberships = pgTable(
  'memberships',
  {
    ...commonDateFields,
    personId: integer('person_id')
      .notNull()
      .references(() => people.id),
    spaceId: integer('space_id')
      .notNull()
      .references(() => spaces.id),
  },
  (table) => [
    uniqueIndex('person_space_idx').on(table.personId, table.spaceId),
  ],
);

export type Membership = InferSelectModel<typeof memberships>;
export type NewMembership = InferInsertModel<typeof memberships>;
