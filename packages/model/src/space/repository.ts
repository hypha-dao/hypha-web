import { Space } from './types';

export interface SpaceRepository {
  findById(id: number): Promise<Space | null>;
  findBySlug(slug: string): Promise<Space | null>;
}
