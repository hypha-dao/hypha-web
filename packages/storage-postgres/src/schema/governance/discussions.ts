import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, pgTable, serial, text } from 'drizzle-orm/pg-core';
import { commonDateFields } from '../shared';
import { people } from '../people';
import { documents } from './document';

export const documentDiscussions = pgTable('document_discussions', {
  id: serial('id').primaryKey(),
  documentId: integer('document_id')
    .notNull()
    .references(() => documents.id),
  parentId: integer('parent_id').references(() => documentDiscussions.id),
  authorId: integer('author_id')
    .notNull()
    .references(() => people.id),
  content: text('content').notNull(),
  ...commonDateFields,
});

export type DocumentDiscussion = InferSelectModel<typeof documentDiscussions>;
export type NewDocumentDiscussion = InferInsertModel<
  typeof documentDiscussions
>;
