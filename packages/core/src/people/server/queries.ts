import {
  PaginationParams,
  PaginatedResponse,
} from '@hypha-platform/core/client';
import { Person } from '../types';
import {
  people,
  Person as DbPerson,
  memberships,
  spaces,
  documents,
} from '@hypha-platform/storage-postgres';
import { sql, eq, inArray, and } from 'drizzle-orm';
import invariant from 'tiny-invariant';
import { DatabaseInstance, DbConfig } from '../../server';

const nullToUndefined = <T>(value: T | null): T | undefined =>
  value === null ? undefined : value;

export const getDefaultFields = () => {
  return {
    id: people.id,
    slug: people.slug,
    avatarUrl: people.avatarUrl,
    description: people.description,
    email: people.email,
    location: people.location,
    name: people.name,
    surname: people.surname,
    nickname: people.nickname,
    createdAt: people.createdAt,
    updatedAt: people.updatedAt,
    address: people.address,
    leadImageUrl: people.leadImageUrl,
    total: sql<number>`cast(count(*) over() as integer)`,
  };
};

export const mapToDomainPerson = (dbPerson: Partial<DbPerson>): Person => {
  invariant(dbPerson.slug, 'Person must have a slug');

  return {
    id: dbPerson.id!,
    name: nullToUndefined(dbPerson.name ?? null),
    surname: nullToUndefined(dbPerson.surname ?? null),
    email: nullToUndefined(dbPerson.email ?? null),
    slug: dbPerson.slug,
    sub: undefined,
    avatarUrl: nullToUndefined(dbPerson.avatarUrl ?? null),
    leadImageUrl: nullToUndefined(dbPerson.leadImageUrl ?? null),
    description: nullToUndefined(dbPerson.description ?? null),
    location: nullToUndefined(dbPerson.location ?? null),
    nickname: nullToUndefined(dbPerson.nickname ?? null),
    address: nullToUndefined(dbPerson.address ?? null),
    links: nullToUndefined(dbPerson.links ?? null),
    createdAt: dbPerson.createdAt!,
    updatedAt: dbPerson.updatedAt!,
  };
};

export type FindAllPeopleConfig = {
  db: DatabaseInstance;
  pagination: PaginationParams<Person>;
};

export const findAllPeople = async (config: FindAllPeopleConfig) => {
  const {
    db,
    pagination: { page = 1, pageSize = 10 },
  } = config;

  const offset = (page - 1) * pageSize;

  type ResultRow = Partial<DbPerson> & { total: number };
  const dbPeople = (await db
    .select(getDefaultFields())
    .from(people)
    .limit(pageSize)
    .offset(offset)) as ResultRow[];

  const total = dbPeople[0]?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return {
    data: dbPeople.map((row) => mapToDomainPerson(row)),
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

export type FindAllPeopleWithoutPaginationConfig = {
  db: DatabaseInstance;
};

export const findAllPeopleWithoutPagination = async ({
  db,
}: FindAllPeopleWithoutPaginationConfig): Promise<Person[]> => {
  type ResultRow = Partial<DbPerson>;
  const dbPeople = (await db
    .select({
      id: people.id,
      slug: people.slug,
      avatarUrl: people.avatarUrl,
      description: people.description,
      email: people.email,
      location: people.location,
      name: people.name,
      surname: people.surname,
      nickname: people.nickname,
      createdAt: people.createdAt,
      updatedAt: people.updatedAt,
      address: people.address,
      leadImageUrl: people.leadImageUrl,
    })
    .from(people)) as ResultRow[];

  return dbPeople.map(mapToDomainPerson);
};

export type FindPersonByIdInput = {
  id: number;
};

export const findPersonById = async (
  { id }: FindPersonByIdInput,
  { db }: DbConfig,
) => {
  const [dbPerson] = await db
    .select()
    .from(people)
    .where(eq(people.id, id))
    .limit(1);

  if (!dbPerson) return null;

  return mapToDomainPerson(dbPerson);
};

export type FindPersonByWeb3AddressInput = {
  address: string;
};
export const findPersonByWeb3Address = async (
  { address }: FindPersonByWeb3AddressInput,
  { db }: DbConfig,
) => {
  const [person] = await db
    .select()
    .from(people)
    .where(eq(sql`upper(${people.address})`, address.toUpperCase()))
    .limit(1);
  if (!person) return null;

  return mapToDomainPerson(person);
};

export type FindPeopleByWeb3AddressesInput = {
  addresses: string[];
};
export const findPeopleByWeb3Addresses = async (
  { addresses }: FindPeopleByWeb3AddressesInput,
  { db }: DbConfig,
) => {
  if (addresses.length === 0) return [];

  const upperAddresses = addresses.map((addr) => addr.toUpperCase());
  console.debug('upperAddresses', upperAddresses);
  const dbPeople = await db
    .select()
    .from(people)
    .where(inArray(sql`upper(${people.address})`, upperAddresses));

  return dbPeople.map(mapToDomainPerson);
};

export type FindPersonBySpaceIdInput = { spaceId: number };
export type FindPersonBySpaceIdConfig = {
  db: DatabaseInstance;
  pagination: PaginationParams<Person>;
  searchTerm?: string;
};
export const findPersonBySpaceId = async (
  { spaceId }: FindPersonBySpaceIdInput,
  { db, searchTerm, ...config }: FindPersonBySpaceIdConfig,
) => {
  const {
    pagination: { page = 1, pageSize = 10 },
  } = config;

  const offset = (page - 1) * pageSize;

  type ResultRow = Partial<DbPerson> & { total: number };

  const whereConditions = [eq(memberships.spaceId, spaceId)];

  if (searchTerm) {
    const term = `%${searchTerm}%`;
    whereConditions.push(
      sql`(${people.name} ILIKE ${term} OR ${people.surname} ILIKE ${term} OR ${people.nickname} ILIKE ${term} OR ${people.email} ILIKE ${term})`,
    );
  }

  const result = (await db
    .select(getDefaultFields())
    .from(people)
    .innerJoin(memberships, eq(memberships.personId, people.id))
    .where(and(...whereConditions))
    .limit(pageSize)
    .offset(offset)) as ResultRow[];

  const total = result[0]?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return {
    data: result.map(mapToDomainPerson),
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

export type FindPeopleBySpaceSlugInput = {
  spaceSlug: string;
};
export type FindPeopleBySpaceSlugConfig = {
  db: DatabaseInstance;
  pagination: PaginationParams<Person>;
};

export const findPeopleBySpaceSlug = async (
  { spaceSlug }: FindPeopleBySpaceSlugInput,
  { db, ...config }: FindPeopleBySpaceSlugConfig,
) => {
  const {
    pagination: { page = 1, pageSize = 10 },
  } = config;

  const offset = (page - 1) * pageSize;

  type ResultRow = Partial<DbPerson> & { total: number };
  const result = (await db
    .select(getDefaultFields())
    .from(people)
    .innerJoin(memberships, eq(memberships.personId, people.id))
    .innerJoin(spaces, eq(memberships.spaceId, spaces.id))
    .where(eq(spaces.slug, spaceSlug))
    .limit(pageSize)
    .offset(offset)) as ResultRow[];

  const total = result[0]?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  return {
    data: result.map(mapToDomainPerson),
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

export type FindPersonBySlugInput = {
  slug: string;
};
export const findPersonBySlug = async (
  { slug }: FindPersonBySlugInput,
  { db }: DbConfig,
) => {
  const [dbPerson] = await db
    .select()
    .from(people)
    .where(eq(people.slug, slug))
    .limit(1);

  if (!dbPerson) return null;

  return mapToDomainPerson(dbPerson);
};

export const findSelf = async ({ db }: DbConfig) => {
  try {
    const [dbPerson] = await db
      .select()
      .from(people)
      .where(sql`sub = auth.user_id()`)
      .limit(1);

    if (!dbPerson) {
      return null;
    }

    return mapToDomainPerson(dbPerson);
  } catch (error) {
    console.error('Error finding authenticated user:', error);
    throw error instanceof Error
      ? new Error('Error finding authenticated user', { cause: error })
      : new Error(String(error));
  }
};

export const verifyAuth = async ({ db }: DbConfig) => {
  try {
    const { rows } = await db.execute(
      sql<{ user_id: string }>`SELECT user_id from auth.user_id()`,
    );
    const user_id = rows[0]?.user_id;
    return !!user_id;
  } catch {
    return false;
  }
};

export const findPersonByAddresses = async (
  addresses: string[],
  {
    pagination,
    searchTerm,
  }: { pagination?: PaginationParams<Person>; searchTerm?: string },
  { db }: DbConfig,
): Promise<PaginatedResponse<Person>> => {
  console.debug('findPersonByAddresses', { searchTerm });
  const uniqueAddresses = Array.from(new Set(addresses));

  const hasPagination =
    pagination?.page != null && pagination?.pageSize != null;
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? uniqueAddresses.length;
  const offset = hasPagination ? (page - 1) * pageSize : 0;

  const whereConditions = [inArray(people.address, uniqueAddresses)];

  if (searchTerm) {
    const term = `%${searchTerm}%`;
    whereConditions.push(
      sql`(${people.name} ILIKE ${term} OR ${people.surname} ILIKE ${term} OR ${people.nickname} ILIKE ${term} OR ${people.email} ILIKE ${term})`,
    );
  }

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(people)
    .where(and(...whereConditions));

  const total = Number(totalResult?.count ?? 0);
  const totalPages = hasPagination ? Math.ceil(total / pageSize) : 1;
  const hasNextPage = hasPagination ? page < totalPages : false;
  const hasPreviousPage = hasPagination ? page > 1 : false;

  type ResultRow = Partial<DbPerson> & { total: number };
  const resultQuery = db
    .select(getDefaultFields())
    .from(people)
    .where(and(...whereConditions));

  const result = hasPagination
    ? ((await resultQuery.offset(offset).limit(pageSize)) as ResultRow[])
    : ((await resultQuery) as ResultRow[]);

  return {
    data: result.map(mapToDomainPerson),
    pagination: {
      total,
      page,
      pageSize: hasPagination ? pageSize : total,
      totalPages,
      hasNextPage,
      hasPreviousPage,
    },
  };
};

export const findDocumentsCreatorsForNotifications = async (
  {
    proposalIds,
  }: {
    proposalIds: number[];
  },
  { db }: DbConfig,
) => {
  return await db
    .select({
      slug: people.slug,
      spaceTitle: spaces.title,
      spaceSlug: spaces.slug,
      proposalTitle: documents.title,
      proposalLabel: documents.label,
      proposalState: documents.state,
    })
    .from(documents)
    .innerJoin(people, eq(documents.creatorId, people.id))
    .innerJoin(spaces, eq(documents.spaceId, spaces.id))
    .where(inArray(documents.web3ProposalId, proposalIds))
    .groupBy(documents.id, people.slug, spaces.slug, spaces.title);
};
