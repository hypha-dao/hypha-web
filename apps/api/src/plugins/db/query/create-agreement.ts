import slugify from 'slugify';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { schema, documents, people, spaces } from '../schema';
import type { DbConfig } from './type';
import { mapToDocument } from './map-to-document';

export interface CreateAgreementInput {
  title: string;
  description: string;
  spaceId: number;
  creatorId: number;
  leadImage?: string;
  attachments?: (string | { name: string; url: string })[];
  web3ProposalId: number;
  slug?: string;
  label?: string;
}

export async function createAgreement(
  {
    title,
    description,
    spaceId,
    creatorId,
    leadImage,
    attachments,
    web3ProposalId,
    slug: maybeSlug,
    label,
  }: CreateAgreementInput,
  { db }: DbConfig<typeof schema>,
) {
  const slug =
    maybeSlug ||
    `${slugify(title, { lower: true }) || 'space'}-${randomUUID().slice(0, 8)}`;

  const [newDocument] = await db
    .insert(documents)
    .values({
      title,
      description,
      spaceId,
      creatorId,
      leadImage,
      attachments,
      web3ProposalId,
      slug,
      label,
    })
    .returning();

  if (!newDocument) {
    throw new Error('Failed to create agreement');
  }

  const spaceCreator = alias(spaces, 'space_creator');

  const [result] = await db
    .select({
      document: documents,
      personCreator: people,
      spaceCreator,
    })
    .from(documents)
    .leftJoin(people, eq(documents.creatorId, people.id))
    .leftJoin(spaceCreator, eq(documents.creatorId, spaceCreator.id))
    .where(eq(documents.id, newDocument.id))
    .limit(1);

  if (!result) {
    return mapToDocument(newDocument, undefined, undefined);
  }

  return mapToDocument(
    result.document,
    result.personCreator ?? undefined,
    result.spaceCreator ?? undefined,
  );
}
