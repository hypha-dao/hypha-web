import { Repository } from '../../container';
import { SpaceConfig, NewSpaceConfig, UpdateSpaceConfig } from './types';

export interface SpaceConfigRepository extends Repository {
  findBySpaceSlug(spaceSlug: string): Promise<SpaceConfig | null>;
  create(config: NewSpaceConfig): Promise<SpaceConfig>;
  update(spaceSlug: string, config: UpdateSpaceConfig): Promise<SpaceConfig>;
  delete(spaceSlug: string): Promise<void>;
}
