import { eq, sql, and } from 'drizzle-orm';

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
