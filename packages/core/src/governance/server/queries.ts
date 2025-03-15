import { DbConfig } from '@core/common/server';
import { eq, sql, and } from 'drizzle-orm';

import {
  documents,
  Document as DbDocument,
  spaces,
} from '@hypha-platform/storage-postgres';
import { DocumentState } from '../types';
import { FilterParams, PaginationParams } from '@core/common';
import { Document } from '../types';

export const mapToDocument = (dbDocument: DbDocument) => {
  return {
    id: dbDocument.id,
    creatorId: dbDocument.creatorId,
    title: dbDocument.title ?? '',
    description: dbDocument.description ?? undefined,
    slug: dbDocument.slug ?? '',
    state: dbDocument.state as DocumentState,
    createdAt: dbDocument.createdAt,
    updatedAt: dbDocument.updatedAt,
  };
};

export type FindDocumentByIdInput = {
  id: number;
};
export const findDocumentById = async (
  { id }: FindDocumentByIdInput,
  { db }: DbConfig,
) => {
  const result = await db
    .select()
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  return result[0] ? mapToDocument(result[0]) : null;
};

export type FindDocumentBySlugInput = {
  slug: string;
};
export const findDocumentBySlug = async (
  { slug }: FindDocumentBySlugInput,
  { db }: DbConfig,
) => {
  const result = await db
    .select()
    .from(documents)
    .where(eq(documents.slug, slug))
    .limit(1);

  return result[0] ? mapToDocument(result[0]) : null;
};

export const findAllDocuments = async ({ db }: DbConfig) => {
  const results = await db.select().from(documents);
  return results.map(mapToDocument);
};

export type FindAllDocumentsBySpaceSlugConfig = {
  pagination: PaginationParams<Document>;
  filter: FilterParams<Document>;
} & DbConfig;

export type FindAllDocumentsBySpaceSlugInput = {
  spaceSlug: string;
};

export const findAllDocumentsBySpaceSlug = async (
  { spaceSlug }: FindAllDocumentsBySpaceSlugInput,
  { db, ...config }: FindAllDocumentsBySpaceSlugConfig,
) => {
  const {
    pagination: { page = 1, pageSize = 10 },
    filter = {},
  } = config;

  const offset = (page - 1) * pageSize;

  const results = await db
    .select({
      document: documents,
      total: sql<number>`cast(count(*) over() as integer)`,
    })
    .from(documents)
    .innerJoin(spaces, eq(documents.spaceId, spaces.id))
    .where(
      and(
        eq(spaces.slug, spaceSlug),
        eq(
          documents.state,
          filter.state as 'discussion' | 'proposal' | 'agreement',
        ),
      ),
    )
    .limit(pageSize)
    .offset(offset);

  const total = results.length > 0 ? results[0].total : 0;
  const totalPages = Math.ceil(total / pageSize);

  return {
    data: results.map((result) => mapToDocument(result.document)),
    pagination: {
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
};

export const findMostRecentDocuments = async ({ db }: DbConfig) => {
  const results = await db
    .select()
    .from(documents)
    .orderBy(documents.createdAt)
    .limit(1);

  return results.length > 0 ? mapToDocument(results[0]) : null;
};
