import { InferInsertModel, InferSelectModel, sql } from 'drizzle-orm';
import { integer, pgTable, serial, timestamp } from 'drizzle-orm/pg-core';
import { commonDateFields } from '../shared';
import { people } from '../people';
import { documents } from './document';
import { agreementStateEnum } from './types';

export const documentAgreements = pgTable('document_agreements', {
  ...commonDateFields,
  documentId: integer('document_id')
    .notNull()
    .references(() => documents.id),
  finalState: agreementStateEnum('final_state').notNull(),
  ratifiedAt: timestamp('ratified_at'),
});

export const documentAgreementSignatures = pgTable(
  'document_agreement_signatures',
  {
    ...commonDateFields,
    agreementId: integer('agreement_id')
      .notNull()
      .references(() => documentAgreements.id),
    signerId: integer('signer_id')
      .notNull()
      .references(() => people.id),
    signedAt: timestamp('signed_at').notNull().defaultNow(),
  },
);

export type DocumentAgreement = InferSelectModel<typeof documentAgreements>;
export type NewDocumentAgreement = InferInsertModel<typeof documentAgreements>;

export type DocumentAgreementSignature = InferSelectModel<
  typeof documentAgreementSignatures
>;
export type NewDocumentAgreementSignature = InferInsertModel<
  typeof documentAgreementSignatures
>;
