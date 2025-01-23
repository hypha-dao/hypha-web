import { Space } from './types';

export interface SpaceRepository {
  findById(id: string): Promise<Space | null>;
  findBySlug(slug: string): Promise<Space | null>;
}
