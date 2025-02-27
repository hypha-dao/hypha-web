import { eq } from 'drizzle-orm';
import { SpaceConfig, NewSpaceConfig, UpdateSpaceConfig } from './types';
import { db } from '@hypha-platform/storage-postgres';
import { spaceConfigs } from '@hypha-platform/storage-postgres';
import { SpaceConfigRepository } from './repository';
import { StorageType } from '../../config/types';

export class SpaceConfigPostgresRepository implements SpaceConfigRepository {
  getStorageType(): StorageType {
    return 'postgres';
  }

  async findBySpaceSlug(spaceSlug: string): Promise<SpaceConfig | null> {
    const [result] = await db
      .select()
      .from(spaceConfigs)
      .where(eq(spaceConfigs.spaceSlug, spaceSlug));

    return result || null;
  }

  async create(config: NewSpaceConfig): Promise<SpaceConfig> {
    const [created] = await db.insert(spaceConfigs).values(config).returning();
    return created;
  }

  async update(
    spaceSlug: string,
    config: UpdateSpaceConfig,
  ): Promise<SpaceConfig> {
    const [updated] = await db
      .update(spaceConfigs)
      .set(config)
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
