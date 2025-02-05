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

// SQL expression to query documents with their current state
export const documentsWithState = sql`
  SELECT
    d.*,
    COALESCE(
      (
        SELECT
          dst.to_state
        FROM
          document_state_transitions dst
        WHERE
          dst.document_id = d.id
        ORDER BY
          dst.created_at DESC
        LIMIT
          1
      ),
      'discussion'
    ) AS state
  FROM
    documents d
`;

export type Document = InferSelectModel<typeof documents>;
export type NewDocument = InferInsertModel<typeof documents>;

export type DocumentWithState = Document & {
  state: (typeof documentStateEnum.enumValues)[number];
};
