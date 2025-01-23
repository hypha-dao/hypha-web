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

  async findChildren(parentId: string): Promise<Space[]> {
    return db.select().from(spaces).where(eq(spaces.parentId, parentId));
  }

  async create(space: Omit<Space, 'id'>): Promise<Space> {
    const id = crypto.randomUUID();
    const [created] = await db
      .insert(spaces)
      .values({ ...space, id })
      .returning();
    return created;
  }

  async update(id: string, space: Partial<Space>): Promise<Space> {
    const [updated] = await db
      .update(spaces)
      .set({ ...space, updatedAt: new Date() })
      .where(eq(spaces.id, id))
      .returning();

    if (!updated) {
      throw new Error(`Space with id ${id} not found`);
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    await db.delete(spaces).where(eq(spaces.id, id));
  }

  async list(
    options: {
      page?: number;
      pageSize?: number;
      sort?: { field: keyof Space; direction: 'asc' | 'desc' };
    } = {},
  ): Promise<{
    items: Space[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { page = 1, pageSize = 10 } = options;

    // Get total count
    const [{ count }] = await db
      .select({ count: spaces.id })
      .from(spaces)
      .$dynamic();

    // Get paginated results
    const items = await db
      .select()
      .from(spaces)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return {
      items,
      total: Number(count),
      page,
      pageSize,
    };
  }
}
