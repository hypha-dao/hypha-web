import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { commonDateFields } from '../shared';
import { people } from '../people';
import { spaces } from '../space';
import { DocumentState } from './types';

export const documentStateEnum = pgEnum('document_state', [
  DocumentState.DRAFT,
  DocumentState.DISCUSSION,
  DocumentState.PROPOSAL,
]);

export const documents = pgTable('documents', {
  ...commonDateFields,
  creatorId: integer('creator_id')
    .notNull()
    .references(() => people.id),
  spaceId: integer('space_id')
    .notNull()
    .references(() => spaces.id),
  title: text('title'),
  description: text('description'),
  slug: varchar('slug', { length: 255 }),
  state: documentStateEnum('state').notNull().default(DocumentState.DRAFT),
  votingStartsAt: timestamp('voting_starts_at'),
  votingEndsAt: timestamp('voting_ends_at'),
});

export type Document = InferSelectModel<typeof documents>;
export type NewDocument = InferInsertModel<typeof documents>;

export type DocumentWithState = Document & {
  state: (typeof documentStateEnum.enumValues)[number];
};
