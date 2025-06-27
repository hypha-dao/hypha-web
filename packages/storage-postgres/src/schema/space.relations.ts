import { relations } from 'drizzle-orm';
import { spaces } from './space';
import { memberships } from './membership';
import { documents } from './document';

export const spacesRelations = relations(spaces, ({ one, many }) => ({
  parent: one(spaces, {
    fields: [spaces.parentId],
    references: [spaces.id],
    relationName: 'subspaces',
  }),
  subspaces: many(spaces, {
    relationName: 'subspaces',
  }),
  members: many(memberships),
  documents: many(documents),
}));
