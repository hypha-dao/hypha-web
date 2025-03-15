import { db as defaultDb, schema } from '@hypha-platform/storage-postgres';
import { CreateSpaceInput, Space, UpdateSpaceInput } from '../types';
import { SpaceRepository } from './repository';
import { Database } from '@hypha-platform/storage-postgres';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { inject, injectable, optional } from 'inversify';
import { DatabaseInstance, DatabaseProvider, SYMBOLS } from '../../_container';
import { createSpace, updateSpaceBySlug } from './mutations';
import {
  findAllSpaces,
  findAllSpacesByMemberId,
  findSpaceById,
  findSpaceBySlug,
} from './queries';

@injectable()
export class SpacePostgresRepository implements SpaceRepository {
  constructor(
    @inject(DatabaseProvider)
    private dbProvider: DatabaseProvider,
    @inject(SYMBOLS.Database.AdminConnection)
    @optional()
    private adminDb: Database | NodePgDatabase<typeof schema> = defaultDb,
  ) {}

  // Get the appropriate database connection - use user connection when available
  private get db(): DatabaseInstance {
    // TODO: enable authentication
    // try {
    //   // Try to get user-specific database with RLS
    //   return this.dbProvider.getUserDatabase();
    // } catch (error) {
    //   // Fall back to admin connection if provider fails
    //   console.warn('Falling back to admin database connection');
    //   return this.adminDb;
    // }
    return this.adminDb;
  }

  async create(data: CreateSpaceInput): Promise<Space> {
    return createSpace(data, { db: this.db as Database });
  }

  async updateBySlug(
    data: { slug: string } & UpdateSpaceInput,
  ): Promise<Space> {
    return updateSpaceBySlug(data, { db: this.db });
  }

  async findAll(): Promise<Space[]> {
    return findAllSpaces({ db: this.db });
  }

  async findById(id: number): Promise<Space | null> {
    return findSpaceById({ id }, { db: this.db });
  }

  async findBySlug(slug: string): Promise<Space | null> {
    return findSpaceBySlug({ slug }, { db: this.db });
  }

  async findAllByMemberId(memberId: number): Promise<Space[]> {
    return findAllSpacesByMemberId({ memberId }, { db: this.db });
  }
}
