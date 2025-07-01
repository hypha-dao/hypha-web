import { schema, db as defaultDb } from '@hypha-platform/storage-postgres';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { injectable, inject, optional } from 'inversify';
import { SYMBOLS } from '../../_container/types';
import { Database } from '@hypha-platform/storage-postgres';
import { Person } from '../types';
import { PaginatedResponse, PaginationParams } from '../../common';
import {
  DatabaseProvider,
  DatabaseInstance,
} from '../../_container/database-provider';

import {
  PeopleFindAllConfig,
  PeopleFindBySpaceConfig,
  PeopleRepository,
} from './repository';
import {
  findAllPeople,
  findPeopleBySpaceSlug,
  findPersonById,
  findPersonByWeb3Address,
  findPersonBySlug,
  findPersonBySpaceId,
  findSelf,
  verifyAuth,
  findPersonByAddresses,
} from './queries';
import { createPerson, deletePerson, updatePerson } from './mutations';

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

  async findAll(
    config: PeopleFindAllConfig,
  ): Promise<PaginatedResponse<Person>> {
    return findAllPeople({ ...config, db: this.db });
  }

  async findById(id: number): Promise<Person | null> {
    return findPersonById({ id }, { db: this.db });
  }

  async findByWeb3Address(address: string): Promise<Person | null> {
    return findPersonByWeb3Address({ address }, { db: this.db });
  }

  async findBySpaceId(
    data: { spaceId: number },
    config: PeopleFindBySpaceConfig,
  ): Promise<PaginatedResponse<Person>> {
    return findPersonBySpaceId(data, { ...config, db: this.db });
  }

  async findBySpaceSlug(
    data: {
      spaceSlug: string;
    },
    config: PeopleFindBySpaceConfig,
  ): Promise<PaginatedResponse<Person>> {
    return findPeopleBySpaceSlug(data, { ...config, db: this.db });
  }

  async findBySlug({ slug }: { slug: string }): Promise<Person | null> {
    return findPersonBySlug({ slug }, { db: this.db });
  }

  async create(person: Person): Promise<Person> {
    return createPerson(person, { db: this.db });
  }

  async update(person: Person): Promise<Person> {
    return updatePerson(person, { db: this.db });
  }

  async delete(id: number): Promise<void> {
    await deletePerson({ id }, { db: this.db });
  }

  /**
   * Find the current authenticated user based on their JWT token
   * This uses auth.user_id() provided by Neon RLS Authorize
   * matching against the sub column in the people table
   */
  async findMe(): Promise<Person | null> {
    return findSelf({ db: this.db });
  }

  async verifyAuth(): Promise<boolean> {
    return verifyAuth({ db: this.db });
  }

  async findByAddresses(
    addresses: string[],
    config: { pagination: PaginationParams<Person> },
  ): Promise<PaginatedResponse<Person>> {
    return findPersonByAddresses(addresses, config, { db: this.db });
  }
}
