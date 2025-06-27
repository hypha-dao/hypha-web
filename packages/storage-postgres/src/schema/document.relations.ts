import { relations } from 'drizzle-orm';
import { spaces } from './space';
import { documents } from './document';

export const documentRelation = relations(documents, ({ one }) => ({
  space: one(spaces, {
    fields: [documents.spaceId],
    references: [spaces.id],
  }),
}));
