import { eq, sql, and } from 'drizzle-orm';
import { schema, spaces, documents, people, type Document } from '../schema';
import type { DbConfig, PaginationParams, FilterParams } from './type';
import { mapToDocument } from './map-to-document';

export interface FindAllDocumentsBySpaceIdConfig
  extends DbConfig<typeof schema> {
  pagination: PaginationParams<Document>;
  filter: FilterParams<Document>;
}

export async function findAllDocumentsBySpaceId(
  { id }: { id: number },
  { db, pagination, filter }: FindAllDocumentsBySpaceIdConfig,
) {
  const { page = 1, pageSize = 20, offset = 0 } = pagination;

  const conditions = [eq(spaces.id, id)];
  if (filter.state) {
    conditions.push(
      eq(
        documents.state,
        filter.state as 'discussion' | 'proposal' | 'agreement',
      ),
    );
  }

  const results = await db
    .select({
      document: documents,
      creator: people,
      total: sql<number>`cast(count(*) over() as integer)`,
    })
    .from(documents)
    .innerJoin(spaces, eq(documents.spaceId, spaces.id))
    .innerJoin(people, eq(documents.creatorId, people.id))
    .where(and(...conditions))
    .limit(pageSize)
    .offset(offset);

  const total = results.at(0)?.total || results.length;
  const totalPages = Math.ceil(total / pageSize);

  return {
    data: results.map(({ document, creator }) =>
      mapToDocument(document, creator),
    ),
    pagination: {
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}
