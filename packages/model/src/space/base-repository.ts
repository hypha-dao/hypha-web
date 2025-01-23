import { Space } from './types';
import { SpaceRepository } from './repository';

export abstract class BaseSpaceRepository implements SpaceRepository {
  abstract findById(id: string): Promise<Space | null>;
  abstract findBySlug(slug: string): Promise<Space | null>;
  abstract create(space: Omit<Space, 'id'>): Promise<Space>;
  abstract update(id: string, space: Partial<Space>): Promise<Space>;
  abstract delete(id: string): Promise<void>;
  abstract list(options?: {
    page?: number;
    pageSize?: number;
    sort?: { field: keyof Space; direction: 'asc' | 'desc' };
  }): Promise<{
    items: Space[];
    total: number;
    page: number;
    pageSize: number;
  }>;

  // Common implementation that can be reused
  async findChildren(parentId: string): Promise<Space[]> {
    const result = await this.list();
    return result.items.filter((space) => space.parentId === parentId);
  }
}
