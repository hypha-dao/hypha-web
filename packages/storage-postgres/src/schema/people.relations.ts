import { relations } from 'drizzle-orm';
import { people } from './people';
import { memberships } from './membership';

export const peopleRelations = relations(people, ({ many }) => ({
  spaces: many(memberships),
}));
