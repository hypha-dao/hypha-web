import { Space } from './types';

export interface SpaceRepository {
  findById(id: string): Promise<Space | null>;
  findBySlug(slug: string): Promise<Space | null>;
  findChildren(parentId: string): Promise<Space[]>;
  create(space: Omit<Space, 'id'>): Promise<Space>;
  update(id: string, space: Partial<Space>): Promise<Space>;
  delete(id: string): Promise<void>;
  list(options?: {
    page?: number;
    pageSize?: number;
    sort?: { field: keyof Space; direction: 'asc' | 'desc' };
  }): Promise<{
    items: Space[];
    total: number;
    page: number;
    pageSize: number;
  }>;
}
