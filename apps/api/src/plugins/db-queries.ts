import { eq, sql, and, inArray } from 'drizzle-orm';

import {
  documents,
  type Document as DbDocument,
  spaces,
  people,
  type Person as DbPerson,
  type Space as DbSpace,
} from './db-schema';
import type {
  DbConfig,
  CreatorType,
  Document,
  DocumentState,
} from '../types/v1/db';
import type { PaginationParams, FilterParams } from '../types/meta';
import { alias } from 'drizzle-orm/pg-core';

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

export type FindAllDocumentsBySpaceIdConfig = {
  pagination: PaginationParams<Document>;
  filter: FilterParams<Document>;
} & DbConfig;

export const findAllDocumentsBySpaceId = async (
  { id }: { id: number },
  { db, pagination, filter }: FindAllDocumentsBySpaceIdConfig,
) => {
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
};

export interface FindDocumentByIdInput {
  id: number;
}

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

export const findDocumentWeb3Id = async (
  { id }: { id: number },
  { db }: DbConfig,
) => {
  const [res] = await db
    .select({
      web3Id: documents.web3ProposalId,
    })
    .from(documents)
    .where(eq(documents.id, id))
    .limit(1);

  return res?.web3Id || null;
};

export const peopleByAddresses = async (
  { addresses }: { addresses: `0x${string}`[] },
  { db, pagination }: DbConfig & { pagination: PaginationParams<DbPerson> },
) => {
  const { pageSize = 20, offset = 0 } = pagination;
  const upperAddresses = addresses.map((addr) => addr.toUpperCase());

  const res = await db
    .select({
      name: people.name,
      surname: people.surname,
      avatarUrl: people.avatarUrl,
      address: people.address,
      total: sql<number>`cast(count(*) over() as integer)`,
    })
    .from(people)
    .where(inArray(sql<string>`upper(${people.address})`, upperAddresses))
    .limit(pageSize)
    .offset(offset)
    .groupBy(people.name, people.surname, people.avatarUrl, people.address);

  const total = res.at(0)?.total ?? 0;
  const data = res.map(({ total, ...rest }) => ({ ...rest }));

  return {
    data,
    meta: {
      total,
      limit: pageSize,
      offset,
    },
  };
};
