import { eq } from 'drizzle-orm';
import { Space, SpaceRepository } from '@hypha-platform/model';
import { db } from '../db';
import { spaces } from '../schema/space';

export class PostgresSpaceRepository implements SpaceRepository {
  async findById(id: string): Promise<Space | null> {
    const results = await db.select().from(spaces).where(eq(spaces.id, id));
    return results[0] || null;
  }

  async findBySlug(slug: string): Promise<Space | null> {
    const results = await db.select().from(spaces).where(eq(spaces.slug, slug));
    return results[0] || null;
  }
}
