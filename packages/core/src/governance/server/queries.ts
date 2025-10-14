import { DbConfig } from '@hypha-platform/core/server';
import { eq, sql, and, asc, desc, SQL } from 'drizzle-orm';

import {
  documents,
  Document as DbDocument,
  spaces,
  people,
  Person as DbPerson,
  Space as DbSpace,
} from '@hypha-platform/storage-postgres';

import { DocumentState } from '../types';
import {
  DirectionType,
  FilterParams,
  Order,
  PaginationParams,
} from '@hypha-platform/core/client';
import { Document } from '../types';
import { alias } from 'drizzle-orm/pg-core';

type CreatorType = {
  avatarUrl?: string;
  name?: string;
  surname?: string;
  type?: 'person' | 'space';
};

export const mapToDocument = (
  dbDocument: DbDocument,
  personCreator?: DbPerson | null,
  spaceCreator?: DbSpace | null,
): Document & { creator?: CreatorType } => {
  let actualCreator: CreatorType | undefined;

  const isInviteSpace = dbDocument.title === 'Invite Space';

  if (isInviteSpace && spaceCreator) {
    actualCreator = {
      avatarUrl: spaceCreator.logoUrl || '',
      name: spaceCreator.title || '',
      surname: '',
      type: 'space',
    };
  } else if (personCreator) {
    actualCreator = {
      avatarUrl: personCreator.avatarUrl || '',
      name: personCreator.name || '',
      surname: personCreator.surname || '',
      type: 'person',
    };
  } else if (spaceCreator) {
    actualCreator = {
      avatarUrl: spaceCreator.logoUrl || '',
      name: spaceCreator.title || '',
      surname: '',
      type: 'space',
    };
  }

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
    creator: actualCreator,
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
};

export interface FindDocumentWithSpaceByIdInput {
  id: number;
}

export const findDocumentWithSpaceById = async (
  { id }: FindDocumentWithSpaceByIdInput,
  { db }: DbConfig,
) => {
  const spaceCreator = alias(spaces, 'space_creator');

  const result = await db
    .select({
      document: documents,
      space: spaces,
      personCreator: people,
      spaceCreator: spaceCreator,
    })
    .from(documents)
    .innerJoin(spaces, eq(documents.spaceId, spaces.id))
    .leftJoin(people, eq(documents.creatorId, people.id))
    .leftJoin(spaceCreator, eq(documents.creatorId, spaceCreator.id))
    .where(eq(documents.web3ProposalId, id))
    .limit(1);

  return result[0]
    ? mapToDocument(
        result[0].document,
        result[0].personCreator ?? undefined,
        result[0].spaceCreator ?? undefined,
      )
    : null;
};

export const findDocumentWithSpaceByIdRaw = async (
  { id }: FindDocumentWithSpaceByIdInput,
  { db }: DbConfig,
) => {
  const spaceCreator = alias(spaces, 'space_creator');

  const result = await db
    .select({
      document: documents,
      space: spaces,
      personCreator: people,
      spaceCreator: spaceCreator,
    })
    .from(documents)
    .innerJoin(spaces, eq(documents.spaceId, spaces.id))
    .leftJoin(people, eq(documents.creatorId, people.id))
    .leftJoin(spaceCreator, eq(documents.creatorId, spaceCreator.id))
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
    .where(eq(documents.slug, slug))
    .limit(1);

  return result[0]
    ? mapToDocument(
        result[0].document,
        result[0].personCreator ?? undefined,
        result[0].spaceCreator ?? undefined,
      )
    : null;
};

export const findAllDocuments = async ({ db }: DbConfig) => {
  const spaceCreator = alias(spaces, 'space_creator');

  const results = await db
    .select({
      document: documents,
      personCreator: people,
      spaceCreator: spaceCreator,
    })
    .from(documents)
    .leftJoin(people, eq(documents.creatorId, people.id))
    .leftJoin(spaceCreator, eq(documents.creatorId, spaceCreator.id));

  return results.map((row) =>
    mapToDocument(
      row.document,
      row.personCreator ?? undefined,
      row.spaceCreator ?? undefined,
    ),
  );
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
  const spaceCreator = alias(spaces, 'space_creator');

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
      personCreator: people,
      spaceCreator: spaceCreator,
      total: sql<number>`cast(count(*) over() as integer)`,
    })
    .from(documents)
    .innerJoin(spaces, eq(documents.spaceId, spaces.id))
    .leftJoin(people, eq(documents.creatorId, people.id))
    .leftJoin(spaceCreator, eq(documents.creatorId, spaceCreator.id))
    .where(and(...conditions))
    .orderBy(...orderBy)
    .limit(pageSize)
    .offset(offset);

  const total = results.length > 0 ? results[0]?.total ?? 0 : 0;
  const totalPages = Math.ceil(total / pageSize);

  return {
    data: results.map((result) =>
      mapToDocument(
        result.document,
        result.personCreator ?? undefined,
        result.spaceCreator ?? undefined,
      ),
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
  const spaceCreator = alias(spaces, 'space_creator');

  const results = await db
    .select({
      document: documents,
      personCreator: people,
      spaceCreator: spaceCreator,
    })
    .from(documents)
    .leftJoin(people, eq(documents.creatorId, people.id))
    .leftJoin(spaceCreator, eq(documents.creatorId, spaceCreator.id))
    .orderBy(desc(documents.createdAt))
    .limit(1);

  const firstResult = results[0];
  return firstResult
    ? mapToDocument(
        firstResult.document,
        firstResult.personCreator ?? undefined,
        firstResult.spaceCreator ?? undefined,
      )
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
  const spaceCreator = alias(spaces, 'space_creator');

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
      personCreator: people,
      spaceCreator: spaceCreator,
    })
    .from(documents)
    .innerJoin(spaces, eq(documents.spaceId, spaces.id))
    .leftJoin(people, eq(documents.creatorId, people.id))
    .leftJoin(spaceCreator, eq(documents.creatorId, spaceCreator.id))
    .where(and(...conditions))
    .orderBy(...orderBy);

  return results.map((result) =>
    mapToDocument(
      result.document,
      result.personCreator ?? undefined,
      result.spaceCreator ?? undefined,
    ),
  );
};
