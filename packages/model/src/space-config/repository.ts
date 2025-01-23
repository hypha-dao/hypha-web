import { SpaceConfig } from './types';

export interface SpaceConfigRepository {
  findBySpaceSlug(spaceSlug: string): Promise<SpaceConfig | null>;
  create(config: SpaceConfig): Promise<SpaceConfig>;
  update(spaceSlug: string, config: Partial<SpaceConfig>): Promise<SpaceConfig>;
  delete(spaceSlug: string): Promise<void>;
}
