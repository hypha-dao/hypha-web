import { InferInsertModel, InferSelectModel, sql } from 'drizzle-orm';
import {
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  varchar,
} from 'drizzle-orm/pg-core';
import { commonDateFields } from '../shared';
import { people } from '../people';

export const documentStateEnum = pgEnum('document_state', [
  'discussion',
  'proposal',
  'agreement',
]);

export const documents = pgTable('documents', {
  id: serial('id').primaryKey(),
  creatorId: integer('creator_id')
    .notNull()
    .references(() => people.id),
  title: text('title'),
  description: text('description'),
  slug: varchar('slug', { length: 255 }),
  ...commonDateFields,
});

// Helper function to get current state
export const getCurrentState = (documentId: number) => sql<
  (typeof documentStateEnum.enumValues)[number]
>`
  SELECT COALESCE(
    (SELECT dst.to_state
     FROM document_state_transitions dst
     WHERE dst.document_id = ${documentId}
     ORDER BY dst.created_at DESC
     LIMIT 1),
    'discussion'
  )
`;

export type Document = InferSelectModel<typeof documents>;
export type NewDocument = InferInsertModel<typeof documents>;
