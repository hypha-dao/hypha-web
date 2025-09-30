import { DbConfig } from '@hypha-platform/core/server';
import { eq, sql, and, asc, desc, SQL } from 'drizzle-orm';

import {
  documents,
  Document as DbDocument,
  spaces,
  people,
  Person as DbPerson,
} from '@hypha-platform/storage-postgres';

import { DocumentState } from '../types';
import {
  DirectionType,
  FilterParams,
  Order,
  PaginationParams,
} from '@hypha-platform/core/client';
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
    label: dbDocument.label || '',
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

export interface FindDocumentWithSpaceByIdInput {
  id: number;
}

export const findDocumentWithSpaceById = async (
  { id }: FindDocumentWithSpaceByIdInput,
  { db }: DbConfig,
) => {
  const result = await db
    .select({
      document: documents,
      space: spaces,
    })
    .from(documents)
    .innerJoin(spaces, eq(documents.spaceId, spaces.id))
    .where(eq(documents.web3ProposalId, id))
    .limit(1);

  return result[0] ?? null;
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

const getDocumentColumnByFieldName = (fieldName: string) => {
  for (const [key, value] of Object.entries(documents)) {
    if (key === fieldName) {
      return value;
    }
  }
  return null;
};

const getOrderBy = (order: Order<Document>) => {
  const orderBy: Array<SQL> = [];
  order.forEach((field) => {
    const column = getDocumentColumnByFieldName(field.name);
    if (!column) {
      return;
    }
    switch (field.dir) {
      case DirectionType.ASC:
        orderBy.push(asc(column));
        break;
      case DirectionType.DESC:
        orderBy.push(desc(column));
        break;
      default:
        break;
    }
  });
  return orderBy;
};

export const findAllDocumentsBySpaceSlug = async (
  { spaceSlug }: FindAllDocumentsBySpaceSlugInput,
  { db, searchTerm, ...config }: FindAllDocumentsBySpaceSlugConfig,
) => {
  const {
    pagination: { page = 1, pageSize = 10, order = [] },
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

  const orderBy = getOrderBy(order);

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
    .orderBy(...orderBy)
    .limit(pageSize)
    .offset(offset);

  // @ts-ignore TODO: fix types
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
    ? // @ts-ignore TODO: fix types
      mapToDocument(results[0].document, results[0].creator)
    : null;
};

export type FindAllDocumentsBySpaceSlugWithoutPaginationInput = {
  spaceSlug: string;
  filter?: FilterParams<Document>;
  searchTerm?: string;
  order?: Order<Document>;
};

export const findAllDocumentsBySpaceSlugWithoutPagination = async (
  {
    spaceSlug,
    filter = {},
    searchTerm,
    order = [],
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

  const orderBy = getOrderBy(order);

  const results = await db
    .select({
      document: documents,
      creator: people,
    })
    .from(documents)
    .innerJoin(spaces, eq(documents.spaceId, spaces.id))
    .innerJoin(people, eq(documents.creatorId, people.id))
    .where(and(...conditions))
    .orderBy(...orderBy);

  return results.map((result) =>
    mapToDocument(result.document, result.creator),
  );
};
