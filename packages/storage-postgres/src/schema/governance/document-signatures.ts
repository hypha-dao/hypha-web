import { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, pgTable, timestamp } from 'drizzle-orm/pg-core';
import { commonDateFields } from '../shared';
import { people } from '../people';
import { documents } from './document';

export const documentSignatures = pgTable('document_signatures', {
  ...commonDateFields,
  documentId: integer('document_id')
    .notNull()
    .references(() => documents.id),
  signerId: integer('signer_id')
    .notNull()
    .references(() => people.id),
  signedAt: timestamp('signed_at').notNull().defaultNow(),
});

export type DocumentSignature = InferSelectModel<typeof documentSignatures>;
export type NewDocumentSignature = InferInsertModel<typeof documentSignatures>;
