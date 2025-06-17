import { DbConfig } from '@core/common/server';
import { eq, sql, and } from 'drizzle-orm';

import {
  documents,
  Document as DbDocument,
  spaces,
  people,
  Person as DbPerson,
} from '@hypha-platform/storage-postgres';

import { DocumentState } from '../types';
import { FilterParams, PaginationParams } from '@core/common';
import { Document, Creator } from '../types';

export const mapToDocument = (
  dbDocument: DbDocument,
  creator?: DbPerson,
): Document & { creator?: Creator } => {
  return {
    id: dbDocument.id,
    creatorId: dbDocument.creatorId,
    title: dbDocument.title ?? '',
    description: dbDocument.description ?? undefined,
    slug: dbDocument.slug ?? '',
    state: dbDocument.state as DocumentState,
    leadImage: dbDocument.leadImage || '',
    attachments: dbDocument.attachments || [],
    createdAt: dbDocument.createdAt,
    updatedAt: dbDocument.updatedAt,
    web3ProposalId: dbDocument.web3ProposalId,
    creator: {
      avatarUrl: creator?.avatarUrl || '',
      name: creator?.name || '',
      surname: creator?.surname || '',
    },
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
    .select({
      document: documents,
      creator: people,
    })
    .from(documents)
    .innerJoin(people, eq(documents.creatorId, people.id))
    .where(eq(documents.id, id))
    .limit(1);

  return result[0]
    ? mapToDocument(result[0].document, result[0].creator)
    : null;
};

export type FindDocumentBySlugInput = {
  slug: string;
};

export const findDocumentBySlug = async (
  { slug }: FindDocumentBySlugInput,
  { db }: DbConfig,
) => {
  const result = await db
    .select({
      document: documents,
      creator: people,
    })
    .from(documents)
    .innerJoin(people, eq(documents.creatorId, people.id))
    .where(eq(documents.slug, slug))
    .limit(1);

  return result[0]
    ? mapToDocument(result[0].document, result[0].creator)
    : null;
};

export const findAllDocuments = async ({ db }: DbConfig) => {
  const results = await db
    .select({
      document: documents,
      creator: people,
    })
    .from(documents)
    .innerJoin(people, eq(documents.creatorId, people.id));

  return results.map((row) => mapToDocument(row.document, row.creator));
};

export type FindAllDocumentsBySpaceSlugConfig = {
  pagination: PaginationParams<Document>;
  filter: FilterParams<Document>;
  searchTerm?: string;
} & DbConfig;

export type FindAllDocumentsBySpaceSlugInput = {
  spaceSlug: string;
};

export const findAllDocumentsBySpaceSlug = async (
  { spaceSlug }: FindAllDocumentsBySpaceSlugInput,
  { db, searchTerm, ...config }: FindAllDocumentsBySpaceSlugConfig,
) => {
  const {
    pagination: { page = 1, pageSize = 10 },
    filter = {},
  } = config;

  const offset = (page - 1) * pageSize;

  const conditions = [eq(spaces.slug, spaceSlug)];

  if (filter.state) {
    conditions.push(
      eq(
        documents.state,
        filter.state as 'discussion' | 'proposal' | 'agreement',
      ),
    );
  }
  if (searchTerm) {
    conditions.push(
      sql`(
            setweight(to_tsvector('english', ${documents.title}), 'A') ||
            setweight(to_tsvector('english', ${documents.description}), 'B')
          ) @@ plainto_tsquery('english', ${searchTerm})`,
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

  const total = results.length > 0 ? results[0].total : 0;
  const totalPages = Math.ceil(total / pageSize);

  return {
    data: results.map((result) =>
      mapToDocument(result.document, result.creator),
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
};

export const findMostRecentDocuments = async ({ db }: DbConfig) => {
  const results = await db
    .select({
      document: documents,
      creator: people,
    })
    .from(documents)
    .innerJoin(people, eq(documents.creatorId, people.id))
    .orderBy(documents.createdAt)
    .limit(1);

  return results.length > 0
    ? mapToDocument(results[0].document, results[0].creator)
    : null;
};

export type FindAllDocumentsBySpaceSlugWithoutPaginationInput = {
  spaceSlug: string;
  filter?: FilterParams<Document>;
  searchTerm?: string;
};

export const findAllDocumentsBySpaceSlugWithoutPagination = async (
  {
    spaceSlug,
    filter = {},
    searchTerm,
  }: FindAllDocumentsBySpaceSlugWithoutPaginationInput,
  { db }: DbConfig,
) => {
  const conditions = [eq(spaces.slug, spaceSlug)];

  if (filter.state) {
    conditions.push(
      eq(
        documents.state,
        filter.state as 'discussion' | 'proposal' | 'agreement',
      ),
    );
  }

  if (searchTerm) {
    conditions.push(
      sql`(
        setweight(to_tsvector('english', ${documents.title}), 'A') ||
        setweight(to_tsvector('english', ${documents.description}), 'B')
      ) @@ plainto_tsquery('english', ${searchTerm})`,
    );
  }

  const results = await db
    .select({
      document: documents,
      creator: people,
    })
    .from(documents)
    .innerJoin(spaces, eq(documents.spaceId, spaces.id))
    .innerJoin(people, eq(documents.creatorId, people.id))
    .where(and(...conditions));

  return results.map((result) =>
    mapToDocument(result.document, result.creator),
  );
};
