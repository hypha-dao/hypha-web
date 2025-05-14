import { PaginationParams } from '@core/common';
import { Person } from '../types';
import { DatabaseInstance } from '@core/_container';
import {
  people,
  Person as DbPerson,
  memberships,
  spaces,
} from '@hypha-platform/storage-postgres';
import { sql, eq } from 'drizzle-orm';
import invariant from 'tiny-invariant';
import { DbConfig } from '@core/common/server';

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
    total: sql<number>`cast(count(*) over() as integer)`,
  };
};

export const mapToDomainPerson = (dbPerson: DbPerson): Person => {
  invariant(dbPerson.slug, 'Person must have a slug');

  return {
    id: dbPerson.id,
    name: nullToUndefined(dbPerson.name),
    surname: nullToUndefined(dbPerson.surname),
    email: nullToUndefined(dbPerson.email),
    slug: dbPerson.slug,
    sub: nullToUndefined(dbPerson.sub),
    avatarUrl: nullToUndefined(dbPerson.avatarUrl),
    leadImageUrl: nullToUndefined(dbPerson.leadImageUrl),
    description: nullToUndefined(dbPerson.description),
    location: nullToUndefined(dbPerson.location),
    nickname: nullToUndefined(dbPerson.nickname),
    address: nullToUndefined(dbPerson.address),
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

  type ResultRow = DbPerson & { total: number };
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

  return dbPerson ? mapToDomainPerson(dbPerson) : null;
};

export type FindPersonBySpaceIdInput = { spaceId: number };
export type FindPersonBySpaceIdConfig = {
  db: DatabaseInstance;
  pagination: PaginationParams<Person>;
};
export const findPersonBySpaceId = async (
  { spaceId }: FindPersonBySpaceIdInput,
  { db, ...config }: FindPersonBySpaceIdConfig,
) => {
  const {
    pagination: { page = 1, pageSize = 10 },
  } = config;

  const offset = (page - 1) * pageSize;

  type ResultRow = DbPerson & { total: number };
  const result = (await db
    .select(getDefaultFields())
    .from(people)
    .innerJoin(memberships, eq(memberships.personId, people.id))
    .where(eq(memberships.spaceId, spaceId))
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

  type ResultRow = DbPerson & { total: number };
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

  return mapToDomainPerson(dbPerson);
};

export const findSelf = async ({ db }: DbConfig) => {
  try {
    // Use Neon's auth.user_id() to get the JWT subject ID
    // and match it against the sub column in the people table
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
    return null;
  }
};

export const verifyAuth = async ({ db }: DbConfig) => {
  try {
    const {
      rows: [{ user_id }],
    } = await db.execute(sql`SELECT user_id from auth.user_id()`);
    return !!user_id;
  } catch {
    return false;
  }
};
