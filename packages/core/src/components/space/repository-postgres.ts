import { asc, eq } from 'drizzle-orm';
import slugify from 'slugify';
import {
  db as defaultDb,
  spaces,
  memberships,
  schema,
} from '@hypha-platform/storage-postgres';
import { CreateSpaceInput, Space, UpdateSpaceInput } from './types';
import { SpaceRepository } from './repository';
import { Database } from '@hypha-platform/storage-postgres';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { inject, injectable, optional } from 'inversify';
import { DatabaseInstance, DatabaseProvider, SYMBOLS } from '../../container';

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

  async create({
    title,
    // TODO: fix slug type
    slug: maybeSlug,
    description,
    ...rest
  }: CreateSpaceInput): Promise<Space> {
    const slug = maybeSlug || slugify(title, { lower: true });

    const [newSpace] = await this.db
      .insert(spaces)
      .values({
        title,
        slug,
        description,
        ...rest,
      })
      .returning();

    if (!newSpace) {
      throw new Error('Failed to create space');
    }

    return newSpace;
  }

  async updateBySlug({
    slug,
    ...rest
  }: { slug: string } & UpdateSpaceInput): Promise<Space> {
    const [updatedSpace] = await this.db
      .update(spaces)
      .set({ ...rest })
      .where(eq(spaces.slug, slug))
      .returning();

    if (!updatedSpace) {
      throw new Error('Failed to update space');
    }

    return updatedSpace;
  }

  async findAll(): Promise<Space[]> {
    const results = await this.db
      .select()
      .from(spaces)
      .orderBy(asc(spaces.title));
    return results;
  }

  async findById(id: number): Promise<Space | null> {
    const results = await this.db
      .select()
      .from(spaces)
      .where(eq(spaces.id, id));
    return results[0] || null;
  }

  async findBySlug(slug: string): Promise<Space | null> {
    const results = await this.db
      .select()
      .from(spaces)
      .where(eq(spaces.slug, slug));
    return results[0] || null;
  }

  async findAllByMemberId(memberId: number): Promise<Space[]> {
    const results = await this.db
      .select()
      .from(spaces)
      .innerJoin(memberships, eq(memberships.spaceId, spaces.id))
      .where(eq(memberships.personId, memberId))
      .orderBy(asc(spaces.title));

    return results.map((row) => row.spaces);
  }
}
