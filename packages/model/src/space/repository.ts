import { Space } from './types';

export interface SpaceRepository {
  findById(id: number): Promise<Space | null>;
  findBySlug(slug: string): Promise<Space | null>;
  create(space: Omit<Space, 'id'>): Promise<Space>;
  update(id: number, space: Partial<Space>): Promise<Space>;
  delete(id: number): Promise<void>;
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
