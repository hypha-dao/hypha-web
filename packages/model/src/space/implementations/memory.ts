import { Space } from '../types';
import { BaseSpaceRepository } from '../base-repository';

export class InMemorySpaceRepository extends BaseSpaceRepository {
  private spaces: Map<string, Space> = new Map();

  async findById(id: string): Promise<Space | null> {
    return this.spaces.get(id) || null;
  }

  async findBySlug(slug: string): Promise<Space | null> {
    return (
      Array.from(this.spaces.values()).find((space) => space.slug === slug) ||
      null
    );
  }

  async create(space: Omit<Space, 'id'>): Promise<Space> {
    const id = crypto.randomUUID();
    const newSpace = { ...space, id };
    this.spaces.set(id, newSpace);
    return newSpace;
  }

  async update(id: string, space: Partial<Space>): Promise<Space> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`Space with id ${id} not found`);
    }
    const updated = { ...existing, ...space };
    this.spaces.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.spaces.delete(id);
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
    const { page = 1, pageSize = 10, sort } = options;
    let items = Array.from(this.spaces.values());

    if (sort) {
      items = items.sort((a, b) => {
        const aValue = a[sort.field];
        const bValue = b[sort.field];
        const modifier = sort.direction === 'asc' ? 1 : -1;
        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return modifier;
        if (bValue === null) return -modifier;
        return aValue < bValue ? -modifier : modifier;
      });
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedItems = items.slice(start, end);

    return {
      items: paginatedItems,
      total: items.length,
      page,
      pageSize,
    };
  }
}
