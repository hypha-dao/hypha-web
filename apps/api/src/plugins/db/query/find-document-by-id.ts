import { eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { schema, spaces, documents, people } from '../schema';
import type { DbConfig } from './type';
import { mapToDocument } from './map-to-document';

export async function findDocumentById(
  { id }: { id: number },
  { db }: DbConfig<typeof schema>,
) {
  const spaceCreator = alias(spaces, 'space_creator');

  const result = await db
    .select({
      document: documents,
      personCreator: people,
      spaceCreator: spaceCreator,
    })
    .from(documents)
    .leftJoin(people, eq(documents.creatorId, people.id))
    .leftJoin(spaceCreator, eq(documents.creatorId, spaceCreator.id))
    .where(eq(documents.id, id))
    .limit(1);

  return result[0]
    ? mapToDocument(
        result[0].document,
        result[0].personCreator ?? undefined,
        result[0].spaceCreator ?? undefined,
      )
    : null;
}
