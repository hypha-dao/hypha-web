import {
  PeopleRepository,
  PeopleFindAllConfig,
  PeopleFindBySpaceConfig,
} from './repository';
import { Person } from './types';
import {
  db as defaultDb,
  memberships,
  people,
  Person as DbPerson,
  spaces,
} from '@hypha-platform/storage-postgres';
import { eq, sql } from 'drizzle-orm';
import type { Database } from '@hypha-platform/storage-postgres';
import { nullToUndefined } from '../../utils/null-to-undefined';
import invariant from 'tiny-invariant';
import { PaginatedResponse } from '../../shared/types';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { schema } from '@hypha-platform/storage-postgres';

export class PeopleRepositoryPostgres implements PeopleRepository {
  constructor(
    private db: Database | NodePgDatabase<typeof schema> = defaultDb,
  ) {}

  private mapToDomainPerson(dbPerson: DbPerson): Person {
    invariant(dbPerson.slug, 'Person must have a slug');

    return {
      id: dbPerson.id,
      name: nullToUndefined(dbPerson.name),
      surname: nullToUndefined(dbPerson.surname),
      email: nullToUndefined(dbPerson.email),
      slug: dbPerson.slug,
      avatarUrl: nullToUndefined(dbPerson.avatarUrl),
      description: nullToUndefined(dbPerson.description),
      location: nullToUndefined(dbPerson.location),
      nickname: nullToUndefined(dbPerson.nickname),
    };
  }

  async findAll(
    config: PeopleFindAllConfig,
  ): Promise<PaginatedResponse<Person>> {
    const {
      pagination: { page = 1, pageSize = 10 },
    } = config;

    const offset = (page - 1) * pageSize;

    type ResultRow = DbPerson & { total: number };
    const dbPeople = (await this.db
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
        total: sql<number>`cast(count(*) over() as integer)`,
      })
      .from(people)
      .limit(pageSize)
      .offset(offset)) as ResultRow[];

    const total = dbPeople[0]?.total ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      data: dbPeople.map((row) => this.mapToDomainPerson(row)),
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

  async findById(id: number): Promise<Person | null> {
    const [dbPerson] = await this.db
      .select()
      .from(people)
      .where(eq(people.id, id))
      .limit(1);

    return dbPerson ? this.mapToDomainPerson(dbPerson) : null;
  }

  async findBySpaceId(
    { spaceId }: { spaceId: number },
    config: PeopleFindBySpaceConfig,
  ): Promise<PaginatedResponse<Person>> {
    const {
      pagination: { page = 1, pageSize = 10 },
    } = config;

    const offset = (page - 1) * pageSize;

    type ResultRow = DbPerson & { total: number };
    const result = (await this.db
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
        total: sql<number>`cast(count(*) over() as integer)`,
      })
      .from(people)
      .innerJoin(memberships, eq(memberships.personId, people.id))
      .where(eq(memberships.spaceId, spaceId))
      .limit(pageSize)
      .offset(offset)) as ResultRow[];

    const total = result[0]?.total ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      data: result.map(this.mapToDomainPerson),
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

  async findBySpaceSlug(
    {
      spaceSlug,
    }: {
      spaceSlug: string;
    },
    config: PeopleFindBySpaceConfig,
  ): Promise<PaginatedResponse<Person>> {
    const {
      pagination: { page = 1, pageSize = 10 },
    } = config;

    const offset = (page - 1) * pageSize;

    type ResultRow = DbPerson & { total: number };
    const result = (await this.db
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
        total: sql<number>`cast(count(*) over() as integer)`,
      })
      .from(people)
      .innerJoin(memberships, eq(memberships.personId, people.id))
      .innerJoin(spaces, eq(memberships.spaceId, spaces.id))
      .where(eq(spaces.slug, spaceSlug))
      .limit(pageSize)
      .offset(offset)) as ResultRow[];

    const total = result[0]?.total ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
      data: result.map(this.mapToDomainPerson),
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

  async findBySlug({ slug }: { slug: string }): Promise<Person> {
    const [dbPerson] = await this.db
      .select()
      .from(people)
      .where(eq(people.slug, slug))
      .limit(1);

    return this.mapToDomainPerson(dbPerson);
  }

  async create(person: Person): Promise<Person> {
    const [dbPerson] = await this.db.insert(people).values(person).returning();
    return this.mapToDomainPerson(dbPerson);
  }

  async update(person: Person): Promise<Person> {
    const [dbPerson] = await this.db
      .update(people)
      .set(person)
      .where(eq(people.id, person.id))
      .returning();
    return this.mapToDomainPerson(dbPerson);
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(people).where(eq(people.id, id));
  }
}
