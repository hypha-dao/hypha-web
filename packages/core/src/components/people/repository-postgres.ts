import { eq, sql } from 'drizzle-orm';
import {
  people,
  spaces,
  memberships,
  schema,
  db as defaultDb,
} from '@hypha-platform/storage-postgres';
import invariant from 'tiny-invariant';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { injectable, inject, optional } from 'inversify';
import { SYMBOLS } from '../../container/types';
import { Database } from '@hypha-platform/storage-postgres';
import { Person } from './types';
import { PaginatedResponse } from '../../shared';
import {
  DatabaseProvider,
  DatabaseInstance,
} from '../../container/database-provider';

import {
  PeopleFindAllConfig,
  PeopleFindBySpaceConfig,
  PeopleRepository,
} from './repository';

// Helper function to convert null to undefined
const nullToUndefined = <T>(value: T | null): T | undefined =>
  value === null ? undefined : value;

// Type from the database
type DbPerson = {
  id: number;
  name: string | null;
  surname: string | null;
  email: string | null;
  slug: string | null;
  avatarUrl: string | null;
  leadImageUrl: string | null;
  description: string | null;
  location: string | null;
  nickname: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  total?: number;
};

@injectable()
export class PeopleRepositoryPostgres implements PeopleRepository {
  constructor(
    @inject(DatabaseProvider)
    private dbProvider: DatabaseProvider,
    @inject(SYMBOLS.Database.AdminConnection)
    @optional()
    private adminDb: Database | NodePgDatabase<typeof schema> = defaultDb,
  ) {}

  // Get the appropriate database connection - use user connection when available
  private get db(): DatabaseInstance {
    try {
      // Try to get user-specific database with RLS
      return this.dbProvider.getUserDatabase();
    } catch (error) {
      // Fall back to admin connection if provider fails
      console.warn('Falling back to admin database connection');
      return this.adminDb;
    }
  }

  private mapToDomainPerson(dbPerson: DbPerson): Person {
    invariant(dbPerson.slug, 'Person must have a slug');

    return {
      id: dbPerson.id,
      name: nullToUndefined(dbPerson.name),
      surname: nullToUndefined(dbPerson.surname),
      email: nullToUndefined(dbPerson.email),
      slug: dbPerson.slug,
      avatarUrl: nullToUndefined(dbPerson.avatarUrl),
      leadImageUrl: nullToUndefined(dbPerson.leadImageUrl),
      description: nullToUndefined(dbPerson.description),
      location: nullToUndefined(dbPerson.location),
      nickname: nullToUndefined(dbPerson.nickname),
    };
  }

  private fields() {
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
      total: sql<number>`cast(count(*) over() as integer)`,
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
      .select(this.fields())
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
      .select(this.fields())
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
      .select(this.fields())
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

  /**
   * Find the current authenticated user based on their JWT token
   * This uses auth.user_id() provided by Neon RLS Authorize
   * matching against the sub column in the people table
   */
  async findMe(): Promise<Person | null> {
    try {
      // Use Neon's auth.user_id() to get the JWT subject ID
      // and match it against the sub column in the people table
      const [dbPerson] = await this.db
        .select()
        .from(schema.people)
        .where(sql`sub = auth.user_id()`)
        .limit(1);

      if (!dbPerson) {
        return null;
      }

      return this.mapToDomainPerson(dbPerson);
    } catch (error) {
      console.error('Error finding authenticated user:', error);
      return null;
    }
  }

  async verifyAuth(): Promise<boolean> {
    try {
      const {
        rows: [{ user_id }],
      } = await this.db.execute(sql`SELECT user_id from auth.user_id()`);
      return !!user_id;
    } catch {
      return false;
    }
  }
}
