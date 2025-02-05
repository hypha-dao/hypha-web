import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, pgTable, serial, text } from 'drizzle-orm/pg-core';
import { commonDateFields } from '../shared';
import { people } from '../people';
import { documents } from './document';
import { governanceStateEnum } from './types';

export const documentStateTransitions = pgTable('document_state_transitions', {
  ...commonDateFields,
  documentId: integer('document_id')
    .notNull()
    .references(() => documents.id),
  fromState: governanceStateEnum('from_state').notNull(),
  toState: governanceStateEnum('to_state').notNull(),
  transitionedBy: integer('transitioned_by')
    .notNull()
    .references(() => people.id),
  reason: text('reason'),
});

export type DocumentStateTransition = InferSelectModel<
  typeof documentStateTransitions
>;
export type NewDocumentStateTransition = InferInsertModel<
  typeof documentStateTransitions
>;
