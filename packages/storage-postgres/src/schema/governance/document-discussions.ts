import { InferInsertModel, InferSelectModel, relations } from 'drizzle-orm';
import { integer, pgTable, text } from 'drizzle-orm/pg-core';
import { commonDateFields } from '../shared';
import { people } from '../people';
import { documents } from './document';

export const documentDiscussions = pgTable('document_discussions', {
  ...commonDateFields,
  documentId: integer('document_id')
    .notNull()
    .references(() => documents.id),
  parentId: integer('parent_id'),
  authorId: integer('author_id')
    .notNull()
    .references(() => people.id),
  content: text('content').notNull(),
});

export const documentDiscussionsRelations = relations(
  documentDiscussions,
  ({ one }) => ({
    parent: one(documentDiscussions, {
      fields: [documentDiscussions.parentId],
      references: [documentDiscussions.id],
    }),
  }),
);

export type DocumentDiscussion = InferSelectModel<typeof documentDiscussions>;
export type NewDocumentDiscussion = InferInsertModel<
  typeof documentDiscussions
>;
