import { relations } from 'drizzle-orm';
import { memberships } from './membership';
import { people } from './people';
import { spaces } from './space';

export const membershipRelation = relations(memberships, ({ one }) => ({
  person: one(people, {
    fields: [memberships.personId],
    references: [people.id],
  }),
  space: one(spaces, {
    fields: [memberships.spaceId],
    references: [spaces.id],
  }),
}));
