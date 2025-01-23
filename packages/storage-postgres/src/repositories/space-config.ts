import { eq } from 'drizzle-orm';
import { SpaceConfig, SpaceConfigRepository } from '@hypha-platform/model';
import { spaceConfigs } from '../schema/space-config';
import { db } from '../db';

export class PostgresSpaceConfigRepository implements SpaceConfigRepository {
  async findBySpaceSlug(spaceSlug: string): Promise<SpaceConfig | null> {
    const [result] = await db
      .select()
      .from(spaceConfigs)
      .where(eq(spaceConfigs.spaceSlug, spaceSlug));

    return result || null;
  }

  async create(config: Omit<SpaceConfig, 'id'>): Promise<SpaceConfig> {
    const id = crypto.randomUUID();
    const [created] = await db
      .insert(spaceConfigs)
      .values({ ...config, spaceSlug: config.spaceSlug })
      .returning();
    return created;
  }

  async update(
    spaceSlug: string,
    config: Partial<SpaceConfig>,
  ): Promise<SpaceConfig> {
    const [updated] = await db
      .update(spaceConfigs)
      .set({ ...config })
      .where(eq(spaceConfigs.spaceSlug, spaceSlug))
      .returning();

    if (!updated) {
      throw new Error(`Space config for space ${spaceSlug} not found`);
    }

    return updated;
  }

  async delete(spaceSlug: string): Promise<void> {
    await db.delete(spaceConfigs).where(eq(spaceConfigs.spaceSlug, spaceSlug));
  }
}
